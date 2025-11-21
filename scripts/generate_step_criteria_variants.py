#!/usr/bin/env python3
"""
One-off migration helper:
Populate step_criteria_sw (SignalWire) and step_criteria_lk (LiveKit) fields
for every active prompt in the given vertical by running the StepCriteriaGenerator.
"""

import asyncio
import os
import sys
from typing import Dict, List, Any

# Make sure project root is on sys.path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
	os.environ["PYTHONUTF8"] = "1"
	sys.path.insert(0, ROOT)

# Load environment variables, but don't crash on malformed .env
try:
	from dotenv import load_dotenv

	try:
		load_dotenv()
	except Exception:
		pass
except ImportError:
	pass

from openai import OpenAI
from supabase import create_client, Client

from database.scripts.backend_integration import StepCriteriaGenerator

VERTICAL = os.getenv("STEP_CRITERIA_VERTICAL", "reverse_mortgage")


def get_supabase_client() -> Client:
	url = os.getenv("SUPABASE_URL")
	key = (
		os.getenv("SUPABASE_SERVICE_KEY")
		or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
		or os.getenv("SUPABASE_KEY")
	)

	if not url or not key:
		raise RuntimeError("Missing SUPABASE_URL or service role key in environment")

	return create_client(url, key)


def fetch_active_nodes(supabase: Client) -> List[Dict[str, Any]]:
	response = (
		supabase.table("prompts")
		.select(
			"id",
			"node_name",
			"current_version",
			"prompt_versions!inner(id, version_number, is_active, content)",
		)
		.eq("vertical", VERTICAL)
		.eq("is_active", True)
		.execute()
	)

	nodes = []
	for prompt in response.data or []:
		current_version = prompt["current_version"]
		pv = next(
			(
				pv
				for pv in prompt["prompt_versions"]
				if pv["version_number"] == current_version and pv["is_active"]
			),
			None,
		)
		if not pv:
			continue

		content = pv.get("content") or {}
		source = content.get("step_criteria_source") or content.get("step_criteria") or ""

		nodes.append(
			{
				"node_name": prompt["node_name"],
				"prompt_version_id": pv["id"],
				"content": content,
				"step_criteria_source": source,
			}
		)

	return nodes


async def main():
	supabase = get_supabase_client()

	nodes = fetch_active_nodes(supabase)
	if not nodes:
		print(f"[WARN] No active prompts found for vertical '{VERTICAL}'")
		return

	# Build payload for generator (it mutates entries in-place)
	nodes_payload = [
		{
			"node_name": node["node_name"],
			"step_criteria_source": node["step_criteria_source"],
		}
		for node in nodes
	]

	openai_key = os.getenv("OPENAI_API_KEY")
	if not openai_key or openai_key.startswith("your_"):
		raise RuntimeError("OPENAI_API_KEY is not set to a valid value")

	openai_client = OpenAI(api_key=openai_key)

	# Supabase client is optional for generator (allows change detection),
	# but for this migration we force regeneration by omitting it.
	generator = StepCriteriaGenerator(openai_client)

	print(f"Generating step_criteria_sw & step_criteria_lk for vertical '{VERTICAL}'...")
	report = await generator.process_vertical_save(nodes_payload, vertical=VERTICAL)

	# Persist results back to Supabase
	for node_payload, node_meta in zip(nodes_payload, nodes):
		sw = node_payload.get("step_criteria_sw")
		lk = node_payload.get("step_criteria_lk")

		if not sw or not lk:
			print(
				f"⚠️  {node_meta['node_name']}: Missing generated criteria "
				f"(sw={'OK' if sw else 'MISSING'}, lk={'OK' if lk else 'MISSING'})"
			)
			continue

		content = dict(node_meta["content"])  # shallow copy
		content["step_criteria_source"] = node_payload["step_criteria_source"]
		content["step_criteria_sw"] = sw
		content["step_criteria_lk"] = lk

		supabase.table("prompt_versions").update({"content": content}).eq(
			"id", node_meta["prompt_version_id"]
		).execute()

	print("Generation complete. Summary:")
	print(report)


if __name__ == "__main__":
	asyncio.run(main())

