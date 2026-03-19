import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class Flasher:
    """
    Handles downloading/reading OS images and flashing them via block device paths.
    """
    
    @staticmethod
    async def flash_image(image_path: str, block_device: str):
        """
        Uses `dd` to flash an image to a block device.
        WARNING: Highly destructive. Use with care.
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image {image_path} not found")
            
        if not block_device.startswith("/dev/s") and not block_device.startswith("/dev/mmcblk"):
            raise ValueError(f"Invalid block device path: {block_device}")
            
        logger.info(f"Flashing {image_path} to {block_device}")
        
        cmd = ["sudo", "dd", f"if={image_path}", f"of={block_device}", "bs=4M", "status=progress"]
        try:
            # We use subprocess.run, this blocks the thread. 
            # In a real async app we might use asyncio.create_subprocess_exec
            proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
            logger.info("Flash completed.")
            
            # Sync to ensure all writes reach disk
            subprocess.run(["sync"], check=True)
            return {"success": True, "output": proc.stderr}
        except subprocess.CalledProcessError as e:
            logger.error(f"Flasher error: {e.stderr}")
            raise Exception(f"Flasher failed: {e.stderr}")
