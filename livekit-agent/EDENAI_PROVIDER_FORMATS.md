# EdenAI TTS Provider Audio Format Reference

**Last Updated:** November 9, 2025  
**Source:** EdenAI Live Testing Interface Screenshots

---

## Provider Format Support Matrix

| Provider | Supported Formats | Recommended Request | Expected Return | Fallback Needed |
|----------|-------------------|---------------------|-----------------|-----------------|
| **ElevenLabs** | `mp3` ONLY | `None` (use default) | `mp3` | ✅ MP3→PCM |
| **OpenAI** | `wav`, `mp3`, `opus`, `aac`, `flac` | `wav` | `wav` | ❌ Direct PCM |
| **Deepgram** | `wav`, `mp3`, `flac`, `aac` | `wav` | `wav` | ❌ Direct PCM |
| **Google** | `wav`, `mp3`, `ogg`, `wav-mulaw`, `wav-alaw` | `wav` | `wav` | ❌ Direct PCM |
| **Lovo** | `wav` | `wav` | `wav` | ❌ Direct PCM |
| **Microsoft** | `wav`, `mp3`, `ogg`, `pcm`, `opus`, `silk`, `webm`, `mulaw`, `alaw`, `amr`, `wav-mulaw`, `wav-alaw` | `wav` or `pcm` | `wav` or `pcm` | ❌ Direct PCM |
| **Amazon** | `mp3`, `ogg`, `pcm` | `pcm` | `pcm` | ❌ Direct PCM |

---

## Implementation Strategy

### Current Approach (Recommended)
**Do NOT specify `audio_format` parameter** - let each provider use their default:
- ElevenLabs → Returns `mp3` (their only format)
- Others → Return their preferred format (usually `wav` or `mp3`)
- Our smart format detection handles everything automatically

### Format Detection & Fallback Pipeline

```python
# 1. Receive audio_data from EdenAI
# 2. Detect format by magic bytes:

if audio_data[:4] == b'RIFF':  # WAV
    pcm_bytes = audio_data[44:]  # Strip 44-byte header → Pure PCM ✅
    
elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':  # MP3
    # Decode with PyAV → PCM ✅
    
elif audio_data[:4] == b'fLaC':  # FLAC
    # Decode with PyAV → PCM ✅
    
else:  # Unknown format
    # Try PyAV decode → PCM ✅
    # Fallback: Treat as raw PCM ✅
```

---

## Provider-Specific Notes

### **ElevenLabs**
- **CRITICAL:** Does NOT support `wav` format
- Requesting `audio_format: 'wav'` will cause API error
- Always returns `mp3` (default and only option)
- **Must use PyAV to decode MP3 → PCM**

### **OpenAI**
- Full format support: `wav`, `mp3`, `opus`, `aac`, `flac`
- Requesting `wav` works perfectly
- Can request specific format if needed

### **Deepgram**
- Supports: `wav`, `mp3`, `flac`, `aac`
- Good `wav` support
- Efficient for real-time streaming

### **Google**
- Extensive format support including telephony formats (`wav-mulaw`, `wav-alaw`)
- Excellent `wav` support
- Good for enterprise/telecom use cases

### **Lovo**
- Basic `wav` support
- Limited format options
- According to EdenAI docs, uses WAV by default

### **Microsoft**
- **Most versatile** - 13+ formats
- Supports both `wav` and raw `pcm`
- Excellent for diverse integration needs
- Good telephony format support

### **Amazon (Polly)**
- Supports: `mp3`, `ogg`, `pcm`
- **Note:** No direct `wav` support
- Can request `pcm` directly (no decoding needed!)
- Good for streaming applications

---

## Cost Considerations

| Provider | Cost (per 1K chars) | Cost (per 1M chars) | Notes |
|----------|---------------------|---------------------|-------|
| **OpenAI** | $0.015 | $15,000 | Cheapest option |
| **Deepgram** | $0.015 | $15,000 | Cheapest option |
| **Google (Standard)** | $0.004 | $4,000 | Budget option |
| **Google (Neural)** | $0.016 | $16,000 | Higher quality |
| **Amazon (Standard)** | $0.004 | $4,000 | Budget option |
| **Amazon (Neural)** | $0.016 | $16,000 | Higher quality |
| **Microsoft** | $0.016 | $16,000 | Enterprise option |
| **Lovo** | $0.160 | $160,000 | Most expensive |
| **ElevenLabs** | $0.300 | $300,000 | Premium quality |

---

## Recommendations by Use Case

### **Best Audio Quality**
1. **ElevenLabs** (Premium - Tiffany voice)
2. Google Neural/Wavenet
3. Amazon Neural

### **Best Cost Efficiency**
1. **OpenAI** ($0.015/1K)
2. **Deepgram** ($0.015/1K)
3. Google/Amazon Standard ($0.004/1K)

### **Best Format Flexibility**
1. **Microsoft** (13+ formats)
2. **Google** (6 formats + telephony)
3. **OpenAI** (5 formats)

### **Best for Real-Time Streaming**
1. **Deepgram** (streaming optimized)
2. **Amazon** (direct PCM support)
3. **OpenAI**

### **Best for Telephony/SIP**
1. **Google** (mulaw/alaw support)
2. **Microsoft** (extensive telephony formats)
3. **Amazon** (PCM support)

---

## Testing Checklist

When testing each provider:
- [ ] Verify audio format returned matches expected
- [ ] Confirm format detection works correctly
- [ ] Test fallback decoding (MP3, FLAC)
- [ ] Validate LiveKit AudioFrame creation
- [ ] Check audio quality and latency
- [ ] Verify cost calculations
- [ ] Test error handling for unsupported formats

---

## Troubleshooting

### **Issue:** No audio output
**Check:**
1. Is EdenAI API returning audio data? (Check logs for `audio_data` length)
2. Is format detection working? (Check logs for format detection messages)
3. Is ffmpeg installed? (Required for PyAV MP3/FLAC decoding)
4. Is AudioFrame being created? (Check for AudioFrame creation logs)

### **Issue:** Audio format error
**Check:**
1. Are you requesting `wav` from ElevenLabs? (Remove audio_format parameter!)
2. Is the provider supported by EdenAI?
3. Is the voice ID valid for the provider?

### **Issue:** Poor audio quality
**Check:**
1. Sample rate mismatch (request 24000 Hz for LiveKit)
2. Incorrect format decoding
3. Provider-specific quality settings

---

## Future Improvements

1. **Provider-Specific Format Requests:**
   ```python
   if provider == 'elevenlabs':
       # Don't specify format (mp3 only)
       pass
   elif provider == 'amazon':
       data['audio_format'] = 'pcm'  # Direct PCM, no decoding!
   else:
       data['audio_format'] = 'wav'  # Request WAV for others
   ```

2. **Streaming Support:**
   - Investigate streaming APIs for Deepgram/OpenAI
   - Reduce latency for real-time conversations

3. **Voice Cloning:**
   - ElevenLabs supports voice cloning
   - Consider custom voice creation for brand consistency

---

## References

- EdenAI TTS API: https://docs.edenai.co/reference/audio_text_to_speech_create
- EdenAI Provider Comparison: https://www.edenai.co/post/ultimate-guide-of-speech-to-text-apis
- LiveKit TTS Plugin Guide: https://docs.livekit.io/agents/plugins/
- PyAV Documentation: https://pyav.org/

---

**Maintained by:** Equity Connect Development Team  
**Contact:** For questions or updates to this document

