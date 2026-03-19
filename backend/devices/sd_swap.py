import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class SDSwapController:
    """
    Controls the Mr-Bossman/SD_Swap device to switch the SD card between the target board (SBC) and the host computer (PC).
    """
    
    @staticmethod
    async def _run_cmd(cmd: str):
        full_cmd = f"sudo sh -c '{cmd}'"
        proc = await asyncio.create_subprocess_shell(
            full_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode().strip()
        err_str = stderr.decode().strip()
        if proc.returncode != 0:
            logger.error(f"Command failed: {cmd}\nReturn code: {proc.returncode}\nStderr: {err_str}")
            return False, err_str
        if out_str or err_str:
            logger.info(f"Command success: {cmd}\nStdout: {out_str}\nStderr: {err_str}")
        return True, out_str

    @staticmethod
    async def switch_to_target(usb_address: str):
        """Switches the SD card to the Target SBC"""
        if not usb_address:
            raise ValueError("No USB address provided for SD_Swap")
        logger.info(f"Switching SD_Swap {usb_address} to Target (SBC)")
        
        # Unbind first
        await SDSwapController._run_cmd(f"echo {usb_address} > /sys/bus/usb/drivers/usb/unbind")
        await asyncio.sleep(0.5)
        # Power Off/Control (Some muxes use specific power states)
        await SDSwapController._run_cmd(f"echo off > /sys/bus/usb/devices/{usb_address}/power/control")
        await SDSwapController._run_cmd(f"echo 0 > /sys/bus/usb/devices/{usb_address}/power/autosuspend_delay_ms")
        return True

    @staticmethod
    async def switch_to_host(usb_address: str):
        """Switches the SD card to the Host PC"""
        if not usb_address:
            raise ValueError("No USB address provided for SD_Swap")
        logger.info(f"Switching SD_Swap {usb_address} to Host (PC)")
        
        # Power On
        await SDSwapController._run_cmd(f"echo on > /sys/bus/usb/devices/{usb_address}/power/control")
        await SDSwapController._run_cmd(f"echo 0 > /sys/bus/usb/devices/{usb_address}/power/autosuspend_delay_ms")
        await asyncio.sleep(1.0)
        # Bind
        await SDSwapController._run_cmd(f"echo {usb_address} > /sys/bus/usb/drivers/usb/bind")
        return True

    @staticmethod
    async def reset_mux(usb_address: str):
        """Force a full reset cycle of the Mux hardware"""
        logger.info(f"Force resetting SD_Swap {usb_address}")
        await SDSwapController.switch_to_target(usb_address)
        await asyncio.sleep(2.0)
        await SDSwapController.switch_to_host(usb_address)
        return True

    @staticmethod
    def get_side(usb_address: str):
        """Returns 'pc' if the device is bound to the host, 'sbc' otherwise."""
        path = Path(f"/sys/bus/usb/drivers/usb/{usb_address}")
        return "pc" if path.exists() else "sbc"
