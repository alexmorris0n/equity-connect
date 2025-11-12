"""Google Vertex AI service for embeddings generation"""
import os
import json
import httpx
import logging
from typing import List
from google.oauth2 import service_account
from google.auth.transport.requests import Request

logger = logging.getLogger(__name__)

async def generate_embedding(question: str) -> List[float]:
	"""Generate embedding vector for a text query using Vertex AI text-embedding-005
	
	Args:
	    question: The text to generate embeddings for
	
	Returns:
	    List of 768 floating point numbers
	"""
	credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
	project_id = os.getenv("GOOGLE_PROJECT_ID", "barbara-475319")
	
	if not credentials_json:
		raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set")
	
	credentials_dict = json.loads(credentials_json)
	credentials = service_account.Credentials.from_service_account_info(
		credentials_dict,
		scopes=["https://www.googleapis.com/auth/cloud-platform"]
	)
	
	# Get access token
	credentials.refresh(Request())
	token = credentials.token
	
	location = "us-central1"
	model = "text-embedding-005"
	url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model}:predict"
	
	async with httpx.AsyncClient() as client:
		response = await client.post(
			url,
			headers={
				"Authorization": f"Bearer {token}",
				"Content-Type": "application/json"
			},
			json={
				"instances": [{"content": question}]
			}
		)
		
		if response.status_code != 200:
			logger.error(f"Vertex AI embeddings failed: {response.status_code} {response.text}")
			raise Exception(f"Vertex AI embeddings failed: {response.status_code}")
		
		data = response.json()
		embedding = data["predictions"][0]["embeddings"]["values"]
		
		logger.debug(f"✅ Generated embedding ({len(embedding)} dimensions)")
		return embedding



