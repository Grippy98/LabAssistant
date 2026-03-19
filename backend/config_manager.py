import json
import os
from pathlib import Path
from typing import Dict, Any

CONFIG_FILE = Path("LabAssistant_config.json")

def load_config() -> Dict[str, Any]:
    if not CONFIG_FILE.exists():
        default_config = {
            "setups": [],
            "ha_token": "",
            "ha_url": ""
        }
        save_config(default_config)
        return default_config
    
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

def save_config(config: Dict[str, Any]) -> None:
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

class ConfigManager:
    def __init__(self):
        self.config = load_config()

    def get_all_setups(self):
        return self.config.get("setups", [])

    def get_setup(self, setup_id: str):
        for setup in self.config.get("setups", []):
            if setup.get("id") == setup_id:
                return setup
        return None

    def update_setup(self, setup_id: str, new_data: Dict[str, Any]):
        for i, setup in enumerate(self.config.get("setups", [])):
            if setup.get("id") == setup_id:
                self.config["setups"][i].update(new_data)
                save_config(self.config)
                return self.config["setups"][i]
        
        # If not found, add new
        new_data["id"] = setup_id
        self.config["setups"].append(new_data)
        save_config(self.config)
        return new_data

    def get_global_config(self):
        return {
            "ha_token": self.config.get("ha_token", ""),
            "ha_url": self.config.get("ha_url", "")
        }
        
    def update_global_config(self, key: str, value: str):
        self.config[key] = value
        save_config(self.config)

    def delete_setup(self, setup_id: str):
        self.config["setups"] = [s for s in self.config.get("setups", []) if s.get("id") != setup_id]
        save_config(self.config)
        return True

    def get_full_config(self):
        return self.config

    def import_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        save_config(self.config)
        return True
