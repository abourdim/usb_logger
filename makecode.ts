/**
 * micro:bit Serial Echo
 * Echoes received messages over USB serial with ">" prefix
 */

// Configure serial buffers
serial.redirectToUSB()
serial.setRxBufferSize(200)
serial.setTxBufferSize(200)

// Echo handler
serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let message = serial.readUntil(serial.delimiters(Delimiters.NewLine))
    serial.writeString(">" + message.trim() + "\n")
})

// Ready indicator
basic.showIcon(IconNames.Yes)
