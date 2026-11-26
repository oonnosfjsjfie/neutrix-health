"""
Natural, human-sounding voice for the Neutrix Assistant (Gemini text-to-speech).

The browser's built-in voices sound robotic, so the assistant's replies are spoken with a Gemini
voice instead: a warm, friendly woman's voice that sounds like a real conversation.
Returns a WAV file. If it fails (quota, slow), the page falls back to the device's own voice.

Voice: NEUTRIX_VOICE env var (default "Despina", smooth and warm; other female voices: Kore, Leda, Zephyr, Sulafat,
Callirrhoe, Despina, Achernar, Vindemiatrix). Key: NEUTRIX_ASSISTANT_API_KEY or GEMINI_API_KEY.
"""
import io
import os
import wave

from google import genai
from google.genai import types

TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-pro-preview-tts"]
STYLE = ("Say this as Emma: a young woman with a beautiful, smooth, warm voice — calm, confident and charming, "
         "softly smiling, gently expressive, relaxed natural pace, like a real person in a friendly conversation. "
         "Never robotic. Text: ")

_clients = {}
_working_model = None


def _keys():
    keys = []
    for name in ("NEUTRIX_ASSISTANT_API_KEY", "GEMINI_API_KEY"):
        k = (os.getenv(name) or "").strip()
        if k and k not in keys:
            keys.append(k)
    return keys or [""]


def client(key=None):
    key = key if key is not None else _keys()[0]
    if key not in _clients:
        _clients[key] = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=20_000, api_version="v1beta"))
    return _clients[key]


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
    voice = voice or os.getenv("NEUTRIX_VOICE", "Despina")
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))
        ),
    )
    models = ([_working_model] if _working_model else []) + [m for m in _tts_models() if m != _working_model]
    last = None
    errors = []
    for model, key in [(m, k) for k in _keys() for m in models]:    # the main key is a spare if the first runs out
        try:
            r = client(key).models.generate_content(model=model, contents=STYLE + text, config=config)
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
            errors.append(f"{model}: {str(e)[:120]}")
            print(f"[voice] {model}: {str(e)[:160]}")
            continue
    ver = getattr(genai, "__version__", "?")
    raise RuntimeError(f"[sdk {ver}] tried {models}: " + (" | ".join(errors) or str(last)))


_found = None


def _tts_models():
    """The voice models this key can use (asks Google once), fastest first; falls back to the known names."""
    global _found
    if _found is None:
        try:
            names = [m.name.split("/")[-1] for m in client().models.list() if "tts" in (m.name or "").lower()]
            names.sort(key=lambda n: (("pro" in n), ("preview" not in n and "flash" not in n), n), reverse=False)
            _found = names or list(TTS_MODELS)
            print(f"[voice] models: {_found}")
        except Exception as e:
            print(f"[voice] could not list models: {str(e)[:120]}")
            _found = list(TTS_MODELS)
    return _found


def stream(text: str, voice: str = ""):
    """Yields raw 16-bit 24 kHz mono audio pieces as they are made, so speaking can start at once.
    The first piece is fetched before returning, so a failure raises here (and the page uses another voice)."""
    global _working_model
    text = (text or "").strip()[:1500]
    if not text:
        raise ValueError("empty")
    voice = voice or os.getenv("NEUTRIX_VOICE", "Despina")
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))
        ),
    )
    models = ([_working_model] if _working_model else []) + [m for m in _tts_models() if m != _working_model]
    errors = []
    for model in models:
        try:
            it = client().models.generate_content_stream(model=model, contents=STYLE + text, config=config)

            def pieces(it=it):
                for chunk in it:
                    for c in (chunk.candidates or []):
                        for part in ((c.content and c.content.parts) or []):
                            if part.inline_data and part.inline_data.data:
                                yield part.inline_data.data

            gen = pieces()
            first = next(gen)          # raises if this model fails
            _working_model = model

            def all_pieces(first=first, gen=gen):
                yield first
                try:
                    yield from gen
                except Exception as e:
                    print(f"[voice] stream stopped: {str(e)[:120]}")
            return all_pieces()
        except StopIteration:
            errors.append(f"{model}: no audio")
        except Exception as e:
            errors.append(f"{model}: {str(e)[:120]}")
            print(f"[voice] {model} (stream): {str(e)[:160]}")
    raise RuntimeError(" | ".join(errors) or "no voice model")
