import asyncio
import serial
import serial.tools.list_ports
import logging

logger = logging.getLogger(__name__)

class SerialMonitor:
    def __init__(self, port: str, baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self._running = False
        
    @staticmethod
    def list_ports():
        ports = serial.tools.list_ports.comports()
        return [{"device": p.device, "description": p.description} for p in ports]
        
    def open(self):
        try:
            self.serial = serial.Serial(self.port, self.baudrate, timeout=0.1)
            self._running = True
            logger.info(f"Opened serial port {self.port} at {self.baudrate}")
        except Exception as e:
            logger.error(f"Failed to open serial port {self.port}: {e}")
            raise

    def close(self):
        self._running = False
        if self.serial and self.serial.is_open:
            self.serial.close()
            logger.info(f"Closed serial port {self.port}")

    async def stream_to_websocket(self, websocket):
        """
        Reads from serial and sends it to the websocket client.
        Listens to websocket to send back to serial.
        """
        if not self._running or not self.serial:
            self.open()

        async def read_from_serial():
            while self._running:
                try:
                    data = self.serial.read_all()
                    if data:
                        await websocket.send_bytes(data)
                    await asyncio.sleep(0.01)
                except Exception as e:
                    logger.error(f"Serial read error: {e}")
                    break

        async def read_from_ws():
            while self._running:
                try:
                    data = await websocket.receive_text()
                    if data and self.serial:
                        self.serial.write(data.encode('utf-8'))
                except Exception as e:
                    logger.error(f"WS read error: {e}")
                    break
        
        try:
            serial_task = asyncio.create_task(read_from_serial())
            ws_task = asyncio.create_task(read_from_ws())
            
            done, pending = await asyncio.wait(
                [serial_task, ws_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True) # Ensure pending tasks are cancelled and awaited
            
        finally:
            self.close()

