from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio

from config_manager import ConfigManager
from devices.sd_swap import SDSwapController
from devices.jetkvm import JetKVMController
from devices.homeassistant import HomeAssistantController
from devices.flasher import Flasher
from devices.ssh_manager import SSHManager
from devices.serial_monitor import SerialMonitor
from devices.system_info import SystemInfo
import httpx

app = FastAPI(title="LabAssistant Core Daemon")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config_mgr = ConfigManager()

class SetupData(BaseModel):
    name: Optional[str] = None
    jetkvm_ip: Optional[str] = None
    sd_swap_address: Optional[str] = None
    serial_port: Optional[str] = None
    ssh_user: Optional[str] = None
    ssh_host: Optional[str] = None
    ha_entity_id: Optional[str] = None
    ha_sensor_ids: Optional[List[str]] = []

class GlobalConfig(BaseModel):
    ha_token: Optional[str] = None
    ha_url: Optional[str] = None

class FlashRequest(BaseModel):
    image_path: str
    block_device: str

class SSHRegisterRequest(BaseModel):
    ssh_pass: str

@app.get("/api/setups")
def get_setups():
    return {"setups": config_mgr.get_all_setups()}

@app.get("/api/setups/{setup_id}")
def get_setup(setup_id: str):
    setup = config_mgr.get_setup(setup_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Setup not found")
    return setup

@app.post("/api/setups/{setup_id}")
def update_setup(setup_id: str, data: SetupData):
    return config_mgr.update_setup(setup_id, data.model_dump(exclude_unset=True))

@app.get("/api/config")
def get_config():
    return config_mgr.get_global_config()

@app.post("/api/config")
def update_config(data: GlobalConfig):
    if data.ha_token is not None:
        config_mgr.update_global_config("ha_token", data.ha_token)
    if data.ha_url is not None:
        config_mgr.update_global_config("ha_url", data.ha_url)
    return {"status": "success"}

@app.delete("/api/setups/{setup_id}")
def delete_setup(setup_id: str):
    config_mgr.delete_setup(setup_id)
    return {"status": "success"}

@app.get("/api/config/export")
def export_config():
    return config_mgr.get_full_config()

@app.post("/api/config/import")
def import_config(data: Dict[str, Any]):
    config_mgr.import_config(data)
    return {"status": "success"}

# --- DEVICE ENDPOINTS ---
@app.post("/api/setups/{setup_id}/sd_swap/{target}")
async def sd_swap_action(setup_id: str, target: str):
    setup = get_setup(setup_id)
    address = setup.get("sd_swap_address")
    if not address:
        raise HTTPException(status_code=400, detail="No sd_swap_address configured")
    
    if target.lower() == "pc":
        await SDSwapController.switch_to_host(address)
    elif target.lower() == "sbc":
        await SDSwapController.switch_to_target(address)
    elif target.lower() == "reset":
        await SDSwapController.reset_mux(address)
    else:
        raise HTTPException(status_code=400, detail="Target must be PC, SBC or Reset")
    return {"status": "success"}

@app.post("/api/setups/{setup_id}/jetkvm/power/{state}")
async def jetkvm_power(setup_id: str, state: str):
    setup = get_setup(setup_id)
    ip = setup.get("jetkvm_ip")
    if not ip:
        raise HTTPException(status_code=400, detail="No jetkvm_ip configured")
    
    kvm = JetKVMController(ip)
    if state == "on":
        return await kvm.power_on()
    elif state == "off":
        return await kvm.power_off()
    else:
        raise HTTPException(status_code=400, detail="State must be on or off")

def get_ha_controller():
    global_cfg = config_mgr.get_global_config()
    ha_token = global_cfg.get("ha_token")
    if not ha_token:
        return None
    ha_url = global_cfg.get("ha_url") or "http://homeassistant.local:8123"
    return HomeAssistantController(ha_url, ha_token)

@app.post("/api/setups/{setup_id}/ha/{state}")
async def homeassistant_power(setup_id: str, state: str):
    setup = get_setup(setup_id)
    entity_id = setup.get("ha_entity_id")
    if not entity_id:
        raise HTTPException(status_code=400, detail="No ha_entity_id configured")
    
    hc = get_ha_controller()
    if not hc:
        raise HTTPException(status_code=400, detail="HA global config missing (token required)")
        
    if state == "on":
        return await hc.turn_on(entity_id)
    elif state == "off":
        return await hc.turn_off(entity_id)
    else:
        raise HTTPException(status_code=400, detail="State must be on or off")

@app.post("/api/setups/{setup_id}/flash")
async def flash_image(setup_id: str, req: FlashRequest):
    return await Flasher.flash_image(req.image_path, req.block_device)

@app.post("/api/setups/{setup_id}/ssh/key")
def generate_ssh_key(setup_id: str):
    key_path, pub_path = SSHManager.generate_keypair(setup_id)
    return {"key_path": key_path, "pub_path": pub_path}

@app.post("/api/setups/{setup_id}/ssh/register")
def register_ssh_key(setup_id: str, req: SSHRegisterRequest):
    setup = get_setup(setup_id)
    if not setup.get("ssh_host") or not setup.get("ssh_user"):
        raise HTTPException(status_code=400, detail="Missing SSH host or user")
    return SSHManager.register_key_ssh_copy_id(setup["ssh_user"], setup["ssh_host"], req.ssh_pass, setup_id)

@app.get("/api/setups/{setup_id}/ha/sensors")
async def get_ha_sensors(setup_id: str):
    setup = get_setup(setup_id)
    sensor_ids = setup.get("ha_sensor_ids", [])
    if not sensor_ids:
        return {"sensors": []}
        
    hc = get_ha_controller()
    if not hc:
        return {"sensors": []}
    results = []
    for sid in sensor_ids:
        try:
            state = await hc.get_state(sid)
            results.append({
                "entity_id": sid,
                "state": state.get("state"),
                "unit": state.get("attributes", {}).get("unit_of_measurement", ""),
                "friendly_name": state.get("attributes", {}).get("friendly_name", sid)
            })
        except Exception:
            results.append({"entity_id": sid, "error": "Could not fetch state"})
    return {"sensors": results}

@app.get("/api/serial/ports")
def list_serial_ports():
    return SerialMonitor.list_ports()

@app.get("/api/system/block_devices")
def get_block_devices():
    return {"devices": SystemInfo.get_block_devices()}

@app.get("/api/system/browse")
def browse_directories(path: str = "/"):
    return SystemInfo.list_directories(path)

@app.get("/api/system/discover_mux")
def discover_mux():
    return {"address": SystemInfo.discover_sd_mux()}

@app.get("/api/system/check_mux/{address}")
def check_mux_status(address: str):
    return {"connected": SystemInfo.check_usb_device(address)}

@app.get("/api/system/mux_side/{address}")
def get_mux_side(address: str):
    return {"side": SDSwapController.get_side(address)}

@app.get("/api/system/images")
def get_local_images(folder: Optional[str] = None):
    return {"images": SystemInfo.get_images(custom_path=folder)}

@app.get("/api/system/ha_entities")
async def list_ha_entities():
    cfg = config_mgr.get_global_config()
    if not cfg.get("ha_token") or not cfg.get("ha_url"):
        return {"entities": []}
    
    url = f"{cfg['ha_url'].rstrip('/')}/api/states"
    headers = {"Authorization": f"Bearer {cfg['ha_token']}", "Content-Type": "application/json"}
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=5.0)
            res.raise_for_status()
            states = res.json()
            entities = []
            for state in states:
                e_id = state.get("entity_id", "")
                name = state.get("attributes", {}).get("friendly_name", e_id)
                if any(e_id.startswith(p) for p in ["switch.", "light.", "input_boolean.", "sensor.", "binary_sensor."]):
                    entities.append({"id": e_id, "name": name})
            return {"entities": entities}
    except Exception:
        return {"entities": []}

@app.websocket("/api/setups/{setup_id}/serial/ws")
async def serial_websocket(websocket: WebSocket, setup_id: str):
    await websocket.accept()
    setup = config_mgr.get_setup(setup_id)
    if not setup or not setup.get("serial_port"):
        await websocket.close(code=1008, reason="Setup or serial_port not found")
        return
        
    monitor = SerialMonitor(port=setup.get("serial_port"))
    try:
        await monitor.stream_to_websocket(websocket)
    except WebSocketDisconnect:
        monitor.close()
    except Exception as e:
        monitor.close()
        await websocket.close(code=1011, reason=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
