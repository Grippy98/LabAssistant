import httpx
import logging

logger = logging.getLogger(__name__)

class HomeAssistantController:
    def __init__(self, ha_url: str, token: str):
        self.base_url = ha_url.rstrip('/')
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    async def _call_service(self, domain: str, service: str, entity_id: str):
        url = f"{self.base_url}/api/services/{domain}/{service}"
        payload = {"entity_id": entity_id}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self.headers, json=payload, timeout=5.0)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"HomeAssistant API error: {e}")
                raise Exception(f"HomeAssistant request failed: {e}")

    async def turn_on(self, entity_id: str):
        """Turn on a smart switch or plug."""
        # Typically homeassistant entities are like switch.my_plug
        domain = entity_id.split('.')[0] if '.' in entity_id else 'switch'
        return await self._call_service(domain, "turn_on", entity_id)

    async def turn_off(self, entity_id: str):
        """Turn off a smart switch or plug."""
        domain = entity_id.split('.')[0] if '.' in entity_id else 'switch'
        return await self._call_service(domain, "turn_off", entity_id)

    async def get_state(self, entity_id: str):
        """Get the current state and attributes of an entity."""
        url = f"{self.base_url}/api/states/{entity_id}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=5.0)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"HomeAssistant API error: {e}")
                raise Exception(f"HomeAssistant state fetch failed: {e}")
