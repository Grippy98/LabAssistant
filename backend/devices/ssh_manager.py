import os
import subprocess
from pathlib import Path

class SSHManager:
    """
    Manages SSH key generation and basic interactions.
    """
    
    @staticmethod
    def generate_keypair(setup_id: str):
        """Generates an ed25519 keypair for a specific setup in a secure directory."""
        key_dir = Path.home() / ".LabAssistant" / "keys"
        key_dir.mkdir(parents=True, exist_ok=True)
        
        key_path = key_dir / f"{setup_id}_ed25519"
        
        if key_path.exists():
            return str(key_path), str(key_path.with_suffix('.pub'))
            
        subprocess.run(["ssh-keygen", "-t", "ed25519", "-f", str(key_path), "-N", "", "-C", f"LabAssistant_{setup_id}"], check=True)
        
        return str(key_path), str(key_path.with_suffix('.pub'))

    @staticmethod
    def read_public_key(setup_id: str):
        key_path = Path.home() / ".LabAssistant" / "keys" / f"{setup_id}_ed25519.pub"
        if key_path.exists():
            with open(key_path, "r") as f:
                return f.read().strip()
        return None
    
    @staticmethod
    def register_key_ssh_copy_id(ssh_user, ssh_host, ssh_pass, setup_id):
        """
        Uses sshpass and ssh-copy-id to push the key.
        Security note: passing password as string is insecure in prod, but typical for labs.
        """
        key_path, _ = SSHManager.generate_keypair(setup_id)
        
        cmd = f"sshpass -p '{ssh_pass}' ssh-copy-id -o StrictHostKeyChecking=no -i {key_path} {ssh_user}@{ssh_host}"
        
        try:
            proc = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
            return {"success": True, "output": proc.stdout}
        except subprocess.CalledProcessError as e:
            return {"success": False, "output": e.stderr}
