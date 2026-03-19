import typer
import httpx
from typing import Optional

app = typer.Typer(help="LabAssistant CLI for board test automation.")
API_URL = "http://localhost:8000/api"

@app.command()
def setups():
    """List all configurations"""
    try:
        r = httpx.get(f"{API_URL}/setups")
        r.raise_for_status()
        setups = r.json().get("setups", [])
        for setup in setups:
            typer.echo(f"[{setup['id']}] {setup.get('name', 'Unnamed')}")
    except Exception as e:
        typer.echo(f"Failed to fetch setups: {e}", err=True)

@app.command()
def sd_swap(setup_id: str, target: str):
    """Switch SD Card to PC or SBC"""
    try:
        r = httpx.post(f"{API_URL}/setups/{setup_id}/sd_swap/{target}")
        r.raise_for_status()
        typer.echo(f"Switched setup {setup_id} to {target}")
    except httpx.HTTPError as e:
        typer.echo(f"API Request Failed: {e}", err=True)

@app.command()
def kvm_power(setup_id: str, state: str):
    """Turn JetKVM on or off"""
    try:
        r = httpx.post(f"{API_URL}/setups/{setup_id}/jetkvm/power/{state}")
        r.raise_for_status()
        typer.echo(f"JetKVM power {state} for setup {setup_id}")
    except httpx.HTTPError as e:
        typer.echo(f"API Request Failed: {e}", err=True)

@app.command()
def ha_power(setup_id: str, state: str):
    """Turn Home Assistant switch on or off"""
    try:
        r = httpx.post(f"{API_URL}/setups/{setup_id}/ha/{state}")
        r.raise_for_status()
        typer.echo(f"HA power {state} for setup {setup_id}")
    except httpx.HTTPError as e:
        typer.echo(f"API Request Failed: {e}", err=True)

@app.command()
def flash(setup_id: str, image: str, device: str):
    """Flash an image to a block device"""
    typer.echo(f"Initiating flash of {image} to {device}...")
    try:
        payload = {"image_path": image, "block_device": device}
        # Disable timeout for long operations
        r = httpx.post(f"{API_URL}/setups/{setup_id}/flash", json=payload, timeout=None)
        r.raise_for_status()
        out = r.json().get("output", "")
        typer.echo(f"Success! Output:\n{out}")
    except httpx.HTTPError as e:
        typer.echo(f"API Request Failed: {e}", err=True)

if __name__ == "__main__":
    app()
