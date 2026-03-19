import subprocess
import json
from pathlib import Path

class SystemInfo:
    @staticmethod
    def get_block_devices():
        try:
            cmd = ["lsblk", "-J", "-o", "NAME,SIZE,TYPE,RM,MODEL"]
            proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
            data = json.loads(proc.stdout)
            devices = []
            for blk in data.get("blockdevices", []):
                if blk.get("type") == "disk":
                    # Mark if it is removable
                    rm = blk.get("rm") in ["1", 1, True]
                    rm_str = "Removable" if rm else "Internal"
                    name = f"/dev/{blk['name']}"
                    model = str(blk.get("model") or "").strip()
                    size = str(blk.get("size") or "").strip()
                    label = f"{name} ({size} - {model} - {rm_str})"
                    devices.append({
                        "path": name, 
                        "label": label, 
                        "is_removable": rm
                    })
            return devices
        except Exception as e:
            return []

    @staticmethod
    def discover_sd_mux():
        """
        Attempts to find the SD Mux USB address by looking for known VID:PIDs.
        Commonly: 1603:452a (Mr-Bossman SD_Swap Mass Storage)
        """
        known_vid_pids = [("1603", "452a")]
        
        base_dir = Path("/sys/bus/usb/devices/")
        if not base_dir.exists():
            return None
            
        try:
            for dev in base_dir.iterdir():
                # We want the folder name (e.g. 1-4)
                if not (dev / "idVendor").exists():
                    continue
                
                vid = (dev / "idVendor").read_text().strip()
                pid = (dev / "idProduct").read_text().strip()
                
                for k_vid, k_pid in known_vid_pids:
                    if vid == k_vid and pid == k_pid:
                        return dev.name
            return None
        except Exception:
            return None

    @staticmethod
    def check_usb_device(address: str):
        """Checks if a USB device exists at the given bus address."""
        path = Path(f"/sys/bus/usb/devices/{address}")
        return path.exists()

    @staticmethod
    def list_directories(root_path: str):
        path = Path(root_path).expanduser().absolute()
        if not path.exists() or not path.is_dir():
            # Fallback to home if path is invalid
            path = Path.home()
        
        try:
            dirs = []
            # Add parent if not at root
            if path != path.parent:
                dirs.append({"name": "..", "path": str(path.parent)})
            
            for f in sorted(path.iterdir()):
                if f.is_dir() and not f.name.startswith('.'):
                    dirs.append({"name": f.name, "path": str(f.absolute())})
            return {"current_path": str(path), "directories": dirs}
        except PermissionError:
            return {"current_path": str(path), "directories": [], "error": "Permission Denied"}
        except Exception as e:
            return {"current_path": str(path), "directories": [], "error": str(e)}

    @staticmethod
    def get_images(custom_path=None):
        paths_to_scan = [Path.home() / "Downloads", Path.home(), Path("/tmp")]
        if custom_path:
            cp = Path(custom_path).expanduser()
            if cp.exists() and cp.is_dir():
                paths_to_scan.insert(0, cp)

        # Only show actual image formats or compressed images
        extensions = [".img", ".iso", ".raw", ".img.xz", ".img.gz", ".img.zip", ".bin"]
        found = []
        for p in paths_to_scan:
            if p.exists() and p.is_dir():
                try:
                    for f in p.iterdir():
                        if f.is_file():
                            fname = f.name.lower()
                            if any(fname.endswith(ext) for ext in extensions):
                                found.append(str(f.absolute()))
                except PermissionError:
                    continue
        return sorted(list(set(found)))
