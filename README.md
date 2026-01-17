# micro:bit Serial Logger

Talk to your micro:bit from your computer using a USB cable!

---

## What Does This Do?

This project lets you:
- Send messages from your computer to your micro:bit
- See messages coming back from the micro:bit
- Test how fast the connection is

It's like texting with your micro:bit!

---

## What You Need

### Hardware
- 1x BBC micro:bit (v1 or v2)
- 1x USB cable (to connect micro:bit to computer)

### Software
- Google Chrome or Microsoft Edge browser
- Internet connection (to open MakeCode)

---

## Setup Steps

### Step 1: Open MakeCode

1. Open your web browser (Chrome or Edge)
2. Go to: **https://makecode.microbit.org**
3. Click **"New Project"**
4. Give it a name like "Serial Echo"

### Step 2: Switch to JavaScript Mode

1. Look at the top of the screen
2. Click on **"JavaScript"** (not Blocks!)

### Step 3: Copy the Code

1. Delete everything in the code area
2. Copy this code and paste it:

```typescript
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
```

### Step 4: Download to micro:bit

1. Connect your micro:bit to your computer with the USB cable
2. Click the **"Download"** button (bottom left)
3. A file will download (something like `microbit-serial-echo.hex`)
4. Drag this file to your micro:bit drive (it shows up like a USB stick)
5. Wait for the yellow light to stop flashing
6. You should see a **checkmark** on the micro:bit screen!

### Step 5: Open the Web App

1. Open the file `index.html` in Chrome or Edge
2. You should see the "micro:bit Serial Logger" page

### Step 6: Connect!

1. Click the **"Connect"** button
2. A popup will appear - select your micro:bit
3. Click **"Connect"** in the popup
4. The status should change to **"Connected"** (green)

---

## How to Use It

### Send a Message

1. Type something in the text box (like "hello")
2. Press **Enter** or click **"Send"**
3. Watch the log - you'll see:
   - `→ hello` (what you sent)
   - `← >hello` (what came back)

### Run a Speed Test

1. Click the **"Test 0..1000"** button
2. Watch the messages fly by!
3. At the end, you'll see statistics:
   - How fast it went (bytes per second)
   - How many retries were needed
   - Success rate

### Other Buttons

| Button | What it does |
|--------|--------------|
| Clear | Erases all messages in the log |
| Copy | Copies all messages to clipboard |
| Export | Downloads messages as a text file |
| Disconnect | Disconnects from micro:bit |

---

## Understanding the Statistics

After running tests, you'll see stats like this:

```
════════════════════════════════════════
TEST #1 COMPLETE
────────────────────────────────────────
  Chunks: 49 | Retries: 15 | Max retry: 3 | Success: 76.6%
  Time: 2.45s | Speed: 1181.2 B/s
════════════════════════════════════════
CUMULATIVE STATS (1 tests)
────────────────────────────────────────
  Total: 2894 bytes | 49 chunks | 15 retries
  Success rate: 76.6%
  Speed: min=1181 avg=1181 max=1181 B/s
  Retries/test: min=15 avg=15.0 max=15
  Max retries for single chunk: 3
  Total time: 2.45s
════════════════════════════════════════
```

### What Does It Mean?

| Term | Meaning |
|------|---------|
| **Chunks** | Big messages are split into small pieces called chunks |
| **Retries** | Sometimes a chunk doesn't send correctly, so we try again |
| **Success rate** | How often chunks worked on the first try |
| **Speed** | How many letters per second we can send (B/s = bytes per second) |
| **Max retry** | The most times we had to retry a single chunk |

---

## Troubleshooting

### "I can't see my micro:bit in the popup"

- Make sure the USB cable is connected
- Try a different USB port
- Make sure you downloaded the code to the micro:bit

### "It says Connected but nothing happens"

- Try clicking Disconnect, then Connect again
- Refresh the web page and try again
- Re-download the code to the micro:bit

### "The test keeps failing"

- This is normal! The USB connection isn't perfect
- The app will retry automatically
- If it fails too much, try disconnecting and reconnecting

### "I don't see the checkmark on micro:bit"

- The code didn't download properly
- Try downloading again
- Make sure you're using MakeCode (not Python editor)

---

## How It Works (Simple Explanation)

1. **You type a message** → The web app sends it through the USB cable
2. **micro:bit receives it** → It adds a ">" at the start and sends it back
3. **Web app receives the reply** → It shows both messages in the log

For long messages:
- The message is cut into small pieces (chunks)
- Each chunk is sent one at a time
- We wait for the micro:bit to reply before sending the next one
- If something goes wrong, we try again!

---

## Fun Things to Try

1. **Send your name** and watch it echo back!
2. **Run multiple tests** and watch the cumulative stats grow
3. **Try sending a really long message** (type lots of numbers with no spaces)
4. **Race with a friend** - who gets higher speed?

---

## Project Files

| File | What it does |
|------|--------------|
| `index.html` | The web page you see |
| `script.js` | The code that makes everything work |
| `style.css` | Makes it look pretty |
| `makecode.ts` | The code for the micro:bit |
| `logo.svg` | The logo image |

---

## Created By

This project uses:
- **Web Serial API** - lets websites talk to USB devices
- **MakeCode** - programming environment for micro:bit

Have fun experimenting!
