# Implementation Plan - Gemini AI Runner Chat Integration

Integrate the Gemini 2.5 Flash API directly into the frontend of the Errand Boy application. This will replace the simple canned responses with a context-aware AI runner agent that responds in character based on the current errand details, progress stage, and user inputs.

## User Review Required

> [!IMPORTANT]
> Since we are running in a static web server environment without a Node/Python backend, we will perform client-side API requests directly to the Gemini API (`https://generativelanguage.googleapis.com`).
> To authenticate, the user will configure their Gemini API Key via a new settings modal. The key will be stored securely in the browser's `localStorage` and never leaves their local machine.

## Proposed Changes

### UI & Styling Updates

#### [MODIFY] [index.html](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/errand-boy/index.html)
- Add a settings button (`🔑`) inside the chat drawer header.
- Add an API Key configuration modal (`#api-key-modal`) to let the user save or clear their Gemini API Key.
- Add a notice banner inside the chat box when no API key is configured.

#### [MODIFY] [style.css](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/errand-boy/style.css)
- Add styles for the `🔑` button in the chat header.
- Ensure the API key config modal has a beautiful Obsidian glassmorphic appearance matching the existing styling system.
- Style the inline API key warning banner inside the chat messages box.

### JavaScript logic

#### [MODIFY] [app.js](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/errand-boy/app.js)
- Maintain the chat history in the active errand state.
- Create helper functions to open/close the API Key modal, save the key to `localStorage`, and clear it.
- Build `callGeminiAPI(userMessage)` using the standard Fetch API:
  - Model: `gemini-2.5-flash`
  - System Instructions: Prompt the model to act as a vetted, polite concierge runner in Lagos. The persona adapts to the active errand type (Market Run, Chauffeur, Dispatch, Laundry), current location, errand details (e.g. shopping list, parcel description), and status log history. Introduce natural local expressions (e.g. "No wahala", "boss", "sir/ma") to sound authentic.
  - Send the accumulated chat history along with the new prompt.
- Update `sendClientChatMessage()` to call the Gemini API when a key is present, showing a typing status indicator, and fallback to the original simulated responses if no key is configured.

## Verification Plan

### Manual Verification
1. Launch the server using `serve.ps1`.
2. Open the page `http://localhost:8080/`.
3. Open the Chat Drawer and click the key icon to configure a Gemini API Key.
4. Book an errand (e.g., Market Run) with a custom shopping list.
5. Open the chat drawer and send instructions (e.g. "Please buy yellow habaneros instead of red ones").
6. Verify that the runner replies realistically in character, acknowledging the shopping list items and the Lagos setting.
