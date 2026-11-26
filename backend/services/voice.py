"""
Natural, human-sounding voice for the Neutrix Assistant (Gemini text-to-speech).

The browser's built-in voices sound robotic, so the assistant's replies are spoken with a Gemini
voice instead: a warm, friendly woman's voice that sounds like a real conversation.
Returns a WAV file. If it fails (quota, slow), the page falls back to the device's own voice.

Voice: NEUTRIX_VOICE env var (default "Aoede"; other female voices: Kore, Leda, Zephyr, Sulafat,
Callirrhoe, Despina, Achernar, Vindemiatrix). Key: NEUTRIX_ASSISTANT_API_KEY or GEMINI_API_KEY.
"""
import io
import os
import wave

from google import genai
from google.genai import types

TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-pro-preview-tts"]
STYLE = ("Read this aloud as a warm, friendly young woman having a relaxed, natural conversation: "
         "a smooth, human, expressive tone, not robotic, at a comfortable pace. Text: ")

_client = None
_working_model = None


def client():
    global _client
    if _client is None:
        key = (os.getenv("NEUTRIX_ASSISTANT_API_KEY") or os.getenv("GEMINI_API_KEY") or "").strip()
        _client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=20_000))
    return _client


def _wav(pcm: bytes, rate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def speak(text: str, voice: str = "") -> bytes:
    """Returns WAV bytes, or raises if no voice model worked."""
    global _working_model
    text = (text or "").strip()[:1500]
    if not text:
        raise ValueError("empty")
    voice = voice or os.getenv("NEUTRIX_VOICE", "Aoede")
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))
        ),
    )
    models = ([_working_model] if _working_model else []) + [m for m in TTS_MODELS if m != _working_model]
    last = None
    for model in models:
        try:
            r = client().models.generate_content(model=model, contents=STYLE + text, config=config)
            part = r.candidates[0].content.parts[0]
            data = part.inline_data.data
            mime = (part.inline_data.mime_type or "").lower()
            rate = 24000
            if "rate=" in mime:
                try:
                    rate = int(mime.split("rate=")[1].split(";")[0])
                except ValueError:
                    pass
            _working_model = model
            return data if "wav" in mime else _wav(data, rate)
        except Exception as e:
            last = e
            print(f"[voice] {model}: {str(e)[:160]}")
            continue
    raise RuntimeError(str(last))
