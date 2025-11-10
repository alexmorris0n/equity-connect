#!/usr/bin/env python3
import onnxruntime as ort
import time
import os

print("=== ONNX Model Load Test ===")
print(f"HF_HOME: {os.environ.get('HF_HOME', 'not set')}")

model_path = "/root/.cache/huggingface/hub/models--livekit--turn-detector/snapshots/ebcab0c09c2b62d926e92180d364df3aaae68a09/onnx/model_q8.onnx"

print(f"\nModel path: {model_path}")
print(f"File exists: {os.path.exists(model_path)}")

if os.path.exists(model_path):
    size_mb = os.path.getsize(model_path) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")

print("\nCreating InferenceSession...")
start = time.time()

try:
    sess = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    elapsed = time.time() - start
    print(f"\n✅ SUCCESS! Model loaded in {elapsed:.2f} seconds")
except Exception as e:
    elapsed = time.time() - start
    print(f"\n❌ FAILED after {elapsed:.2f} seconds")
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

