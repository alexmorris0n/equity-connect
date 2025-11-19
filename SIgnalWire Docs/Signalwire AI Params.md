[Skip to main content](https://developer.signalwire.com/swml/methods/ai/params/#__docusaurus_skipToContent_fallback)

On this page

Parameters for AI that can be passed in `ai.params` at the top level of the [`ai` Method](https://developer.signalwire.com/swml/methods/ai/params).

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `params`Optional | `object` | - | An object that accepts the [`params parameters`](https://developer.signalwire.com/swml/methods/ai/params/#params-parameters). |

## **params Parameters** [​](https://developer.signalwire.com/swml/methods/ai/params/\#params-parameters "Direct link to params-parameters")

### Core AI Behavior [​](https://developer.signalwire.com/swml/methods/ai/params/\#core-ai-behavior "Direct link to Core AI Behavior")

These parameters control the fundamental behavior and capabilities of the AI agent, including model selection, conversation management, and advanced features like thinking and vision.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `ai_model`Optional | `string` | `gpt-4o-mini` | The AI model that the AI Agent will use during the conversation.<br>**Available AI Models:**`gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano` |
| [`conscience`](https://developer.signalwire.com/swml/methods/ai/params/conscience) Optional | `string` | `"Remember to stay in character. You must not do anything outside the scope of your provided role."` | Sets the prompt which binds the agent to its purpose. |
| `thinking_model`Optional | `string` | Value of `ai_model` | The AI model that the AI Agent will use when utilizing thinking capabilities.<br>**Available AI Models:**`gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano` |
| `vision_model`Optional | `string` | Value of `ai_model` | The AI model that the AI Agent will use when utilizing vision capabilities.<br>**Available AI Models:**`gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano` |
| `enable_thinking`Optional | `boolean` | `false` | Enables thinking output for the AI Agent. When set to `true`, the AI Agent will be able to utilize thinking capabilities.<br>**Important**: This may introduce a little bit of latency as the AI will use an additional turn in the conversation to think about the query. |
| `enable_vision`Optional | `boolean` | `false` | Enables visual input processing for the AI Agent. The image that will be used for visual processing will be gathered from the users camera if video is available on the call.<br>When set to `true`, the AI Agent will be able to utilize visual processing capabilities, while leveraging the [`get_visual_input`](https://developer.signalwire.com/swml/methods/ai/swaig/internal_fillers#internal_fillers-parameters) function. |
| `wait_for_user`Optional | `boolean` | `false` | When false, AI agent will initialize dialogue after call is setup. When true, agent will wait for the user to speak first. |
| `direction`Optional | `string` | the natural direction of the call | Forces the direction of the call to the assistant. Valid values are `inbound` and `outbound`. |
| `conversation_id`Optional | `string` | - | Used by `check_for_input` and `save_conversation` to identify an individual conversation. |
| `local_tz`Optional | `string` | `GMT` | The local timezone setting for the AI. Value should use [IANA TZ ID](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) |
| `save_conversation`Optional | `boolean` | `false` | Send a summary of the conversation after the call ends. This requires a `post_url` to be set in the [`ai parameters`](https://developer.signalwire.com/swml/methods/ai/params) and the `conversation_id` defined below. This eliminates the need for a `post_prompt` in the `ai` parameters. |
| `transfer_summary`Optional | `boolean` | `false` | Pass a summary of a conversation from one AI agent to another. For example, transfer a call summary between support agents in two departments. |
| `languages_enabled`Optional | `boolean` | `false` | Allows multilingualism when `true`. |
| `conversation_sliding_window`Optional | `integer` | - | Sets the conversation history window size (number of turns to keep in context). |
| `summary_mode`Optional | `string` | - | Summary generation mode. Valid values: `"string"`, `"original"`. |

### Speech Recognition [​](https://developer.signalwire.com/swml/methods/ai/params/\#speech-recognition "Direct link to Speech Recognition")

Configure how the AI agent processes and understands spoken input, including speaker identification, voice activity detection, and transcription settings.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `asr_diarize`Optional | `boolean` | `false` | If true, enables speaker diarization in ASR (Automatic Speech Recognition). This will break up the transcript into chunks, with each chunk containing a unique identity (e.g speaker1, speaker2, etc.) and the text they spoke. |
| `asr_speaker_affinity`Optional | `boolean` | `false` | If true, will force the AI Agent to only respond to the speaker who responds to the AI Agent first. Any other speaker will be ignored. |
| `asr_smart_format`Optional | `boolean` | `false` | Enables smart formatting for ASR output, improving the readability of transcribed text. |
| `openai_asr_engine`Optional | `string` | `deepgram:nova-3` | The ASR (Automatic Speech Recognition) engine to use. Common values include `deepgram:nova-2`, `deepgram:nova-3`, and other supported ASR engines. |
| `energy_level`Optional | `number` | `52` | Amount of energy necessary for bot to hear you (in dB). Allowed values from `0.0`-`100.0`. |
| `llm_diarize_aware`Optional | `boolean` | `false` | If true, the AI Agent will be involved with the diarization process. Users can state who they are at the start of the conversation and the AI Agent will be able to correctly identify them when they are speaking later in the conversation. |
| `end_of_speech_timeout`Optional | `integer` | `700` ms | Amount of silence, in ms, at the end of an utterance to detect end of speech. Allowed values from `0`-`10,000`. |
| `first_word_timeout`Optional | `integer` | `1000` ms | Timeout for detecting the first word of user speech. Allowed values from `0`-`10,000` ms. |

### Speech Synthesis [​](https://developer.signalwire.com/swml/methods/ai/params/\#speech-synthesis "Direct link to Speech Synthesis")

Customize the AI agent's voice output, including volume control, voice characteristics, emotional range, and video avatars for visual interactions.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `ai_volume`Optional | `integer` | `0` (the natural volume of the AI) | Adjust the volume of the AI. Allowed values from `-50`-`50`. |
| `tts_number_format`Optional | `string` | `international` | The format of the number the AI will reference the phone number.<br>**Valid Values**: `international`(e.g. **+12345678901**) or `national`(e.g. **(234) 567-8901**). |
| `eleven_labs_stability`Optional | `number` | - | The stability slider determines how stable the voice is and the randomness between each generation. Lowering this slider introduces a broader emotional range for the voice. Valid values range from `0.01` to `1.0`.<br>**Important**: This will only works when `elevenlabs` is set in the [`ai.languages.voice`](https://developer.signalwire.com/swml/methods/ai/languages) as the engine id. |
| `eleven_labs_similarity`Optional | `number` | - | The similarity slider dictates how closely the AI should adhere to the original voice when attempting to replicate it. The higher the similarity, the closer the AI will sound to the original voice. Valid values range from `0.01` to `1.0`.<br>**Important**: This will only works when `elevenlabs` is set in the [`ai.languages.voice`](https://developer.signalwire.com/swml/methods/ai/languages) as the engine id. |
| `video_talking_file`Optional | `string` | - | URL of a video file to play when AI is talking. Only works for calls that support video. |
| `video_idle_file`Optional | `string` | - | URL of a video file to play when AI is idle. Only works for calls that support video. |
| `video_listening_file`Optional | `string` | - | URL of a video file to play when AI is listening to the user speak. Only works for calls that support video. |
| `max_emotion`Optional | `integer` | `30` | Maximum emotion intensity for text-to-speech. Allowed values from `1`-`30`. |
| `speech_gen_quick_stops`Optional | `integer` | `3` | Number of quick stops for speech generation. Allowed values from `0`-`10`. |

### Interruption & Barge Control [​](https://developer.signalwire.com/swml/methods/ai/params/\#interruption--barge-control "Direct link to Interruption & Barge Control")

Manage how the AI agent handles interruptions when users speak over it, including when to stop speaking, acknowledge interruptions, or continue regardless.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `acknowledge_interruptions`Optional | `boolean` \| `number` | `false` | Instructs the agent to acknowledge crosstalk and confirm user input when the user speaks over the agent. Can be boolean or a positive integer specifying the maximum number of interruptions to acknowledge. |
| `enable_barge`Optional | `string` | `"complete,partial"` | Controls when user can interrupt the AI. Valid values: `"complete"`, `"partial"`, `"all"`, or boolean. Set to `false` to disable barging. |
| `transparent_barge`Optional | `boolean` | `true` | When enabled, the AI will not respond to the user's input when the user is speaking over the agent. The agent will wait for the user to finish speaking before responding. Additionally, any attempt the LLM makes to barge will be ignored and scraped from the conversation logs. |
| `barge_match_string`Optional | `string` | - | Takes a string, including a regular expression, defining barge behavior. For example, this param can direct the AI to stop when the word "hippopotomus" is input. |
| `barge_min_words`Optional | `integer` | - | Defines the number of words that must be input before triggering barge behavior. Allowed values from `1`-`99`. |
| `interrupt_on_noise`Optional | `boolean` \| `integer` | `false` | When enabled, barges agent upon any sound interruption longer than 1 second. Can be boolean or a positive integer specifying the threshold. |
| [`interrupt_prompt`](https://developer.signalwire.com/swml/methods/ai/params/interrupt_prompt) Optional | `string` | - | Provide a prompt for the agent to handle crosstalk. |
| `barge_functions`Optional | `boolean` | `true` | Allow functions to be called during barging. When `false`, functions are not executed if the user is speaking. |
| `transparent_barge_max_time`Optional | `integer` | `3000` ms | Maximum duration for transparent barge mode. Allowed values from `0`-`60,000` ms. |

### Timeouts & Delays [​](https://developer.signalwire.com/swml/methods/ai/params/\#timeouts--delays "Direct link to Timeouts & Delays")

Set various timing parameters that control wait times, response delays, and session limits to optimize the conversation flow and prevent dead air.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `attention_timeout`Optional | `integer` | `5000` ms | Amount of time, in ms, to wait before prompting the user to respond. Allowed values: `0` (to disable) or `10,000`-`600,000`. |
| `attention_timeout_prompt`Optional | `string` | `The user has not responded, try to get their attention. Stay in the same language.` | A custom prompt that is fed into the AI when the `attention_timeout` is reached. |
| `inactivity_timeout`Optional | `integer` | `600000` ms | Amount of time, in ms, to wait before exiting the app due to inactivity. Allowed values: `0` (to disable) or `10,000`-`3,600,000`. |
| `outbound_attention_timeout`Optional | `integer` | `120000` ms | Sets a time duration for the outbound call recipient to respond to the AI agent before timeout. Allowed values from `10,000`-`600,000` ms. |
| `initial_sleep_ms`Optional | `integer` | `0` | Amount of time, in ms, to wait before the AI Agent starts processing. Allowed values from `0`-`300,000`. |
| `speech_event_timeout`Optional | `integer` | `1400` ms | Timeout for speech events processing. Allowed values from `0`-`10,000` ms. |
| `digit_timeout`Optional | `integer` | `3000` ms | Time, in ms, at the end of digit input to detect end of input. Allowed values from `0`-`30,000`. |
| `hard_stop_time`Optional | `string` | - | Specifies the maximum duration for the AI Agent to remain active before it exits the session. After the timeout, the AI will stop responding, and will proceed with the next SWML instruction.<br>**Time Format**<br>- Seconds Format: `30s`<br>- Minutes Format: `2m`<br>- Hours Format: `1h`<br>- Combined Format: `1h45m30s` |
| `hard_stop_prompt`Optional | `string` | `"Explain to the user that the call has reached its maximum duration and you need to end the conversation."` | A final prompt that is fed into the AI when the `hard_stop_time` is reached. |
| `speech_timeout`Optional | `integer` | `60000` ms | Overall speech timeout (developer mode only). Allowed values from `0`-`600,000` ms. |

### Audio & Media [​](https://developer.signalwire.com/swml/methods/ai/params/\#audio--media "Direct link to Audio & Media")

Control background audio, hold music, and greeting messages to enhance the caller experience during different phases of the conversation.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `background_file`Optional | `string` | - | URL of audio file to play in the background while AI plays in foreground. |
| `background_file_loops`Optional | `integer` | `undefined` (loops indefinitely) | Maximum number of times to loop playing the background file. |
| `background_file_volume`Optional | `integer` | `0` | Defines `background_file` volume. Allowed values from `-50` to `50`. |
| [`hold_music`](https://developer.signalwire.com/swml/methods/ai/params/hold_music) Optional | `string` | - | A URL for the hold music to play, accepting WAV, mp3, and [FreeSWITCH tone\_stream](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Modules/mod-dptools/mod-dptools:-gentones/Tone_stream_6586599/). |
| `hold_on_process`Optional | `boolean` | `false` | Enables hold music during SWAIG processing. |
| `static_greeting`Optional | `string` | - | A static greeting to play at the start of the call. |
| `static_greeting_no_barge`Optional | `boolean` | `false` | If `true`, the static greeting will not be interrupted by the user if they speak over the greeting. If `false`, the static greeting can be interrupted by the user if they speak over the greeting. |

### SWAIG Functions [​](https://developer.signalwire.com/swml/methods/ai/params/\#swaig-functions "Direct link to SWAIG Functions")

Configure SignalWire AI Gateway (SWAIG) function capabilities, including permissions, execution timing, and data persistence across function calls.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `swaig_allow_swml`Optional | `boolean` | `true` | Allows your SWAIG to return SWML to be executed. |
| `swaig_allow_settings`Optional | `boolean` | `true` | Allows tweaking any of the indicated settings, such as barge\_match\_string, using the returned SWML from the SWAIG function. |
| `swaig_post_conversation`Optional | `boolean` | `false` | Post entire conversation to any SWAIG call. |
| `function_wait_for_talking`Optional | `boolean` | `false` | If `true`, the AI will wait for any [`filler`](https://developer.signalwire.com/swml/methods/ai/swaig/functions/fillers) to finish playing before executing a function.<br>If `false`, the AI will asynchronously execute a function while playing a filler. |
| `swaig_set_global_data`Optional | `boolean` | `true` | Allows SWAIG functions to set global data that persists across function calls. |
| `functions_on_no_response`Optional | `boolean` | `false` | Execute functions when the user doesn't respond (on attention timeout). |

### Input & DTMF [​](https://developer.signalwire.com/swml/methods/ai/params/\#input--dtmf "Direct link to Input & DTMF")

Handle dual-tone multi-frequency (DTMF) input and configure input polling for integrating external data sources during conversations.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `digit_terminators`Optional | `string` | - | DTMF digit, as a string, to signal the end of input (ex: "#") |
| `input_poll_freq`Optional | `integer` | `2000` ms | Check for input function with `check_for_input`. Allowed values from `1,000`-`10,000` ms. Example use case: Feeding an inbound SMS to AI on a voice call, eg., for collecting an email address or other complex information. |

### Debug & Development [​](https://developer.signalwire.com/swml/methods/ai/params/\#debug--development "Direct link to Debug & Development")

Enable debugging tools, logging, and performance monitoring features to help developers troubleshoot and optimize their AI agent implementations.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `debug_webhook_url`Optional | `string` | - | Each interaction between the AI and end user is posted in real time to the established URL. Authentication can also be set in the url in the format of `username:password@url`. |
| `debug_webhook_level`Optional | `integer` | `1` | Enables debugging to the set URL. Allowed values from `0`-`2`. Level 0 disables, 1 provides basic info, 2 provides verbose info. |
| `audible_debug`Optional | `boolean` | `false` | If `true`, the AI will announce the function that is being executed on the call. |
| `verbose_logs`Optional | `boolean` | `false` | Enable verbose logging (developer mode only). |
| `cache_mode`Optional | `boolean` | `false` | Enable response caching to improve performance for repeated queries. |
| `enable_accounting`Optional | `boolean` | `false` | Enable usage accounting and tracking for billing and analytics purposes. |
| `audible_latency`Optional | `boolean` | `false` | Announce latency information during the call for debugging purposes. |

**Was this helpful?**

- [**params Parameters**](https://developer.signalwire.com/swml/methods/ai/params/#params-parameters)
  - [Core AI Behavior](https://developer.signalwire.com/swml/methods/ai/params/#core-ai-behavior)
  - [Speech Recognition](https://developer.signalwire.com/swml/methods/ai/params/#speech-recognition)
  - [Speech Synthesis](https://developer.signalwire.com/swml/methods/ai/params/#speech-synthesis)
  - [Interruption & Barge Control](https://developer.signalwire.com/swml/methods/ai/params/#interruption--barge-control)
  - [Timeouts & Delays](https://developer.signalwire.com/swml/methods/ai/params/#timeouts--delays)
  - [Audio & Media](https://developer.signalwire.com/swml/methods/ai/params/#audio--media)
  - [SWAIG Functions](https://developer.signalwire.com/swml/methods/ai/params/#swaig-functions)
  - [Input & DTMF](https://developer.signalwire.com/swml/methods/ai/params/#input--dtmf)
  - [Debug & Development](https://developer.signalwire.com/swml/methods/ai/params/#debug--development)

Sign Up