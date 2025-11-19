Basic Example
[
  {
    "body": "You are a helpful AI assistant with specific capabilities.",
    "bullets": [
      "Follow user instructions carefully",
      "Maintain professional tone"
    ],
    "numbered": true,
    "subsections": [
      {
        "title": "Communication Style",
        "body": "When communicating, follow these guidelines:",
        "numberedBullets": true,
        "bullets": [
          "Be clear and concise",
          "Use professional language"
        ]
      }
    ]
  },
  {
    "title": "Task Execution",
    "body": "When executing tasks, follow this process:",
    "bullets": [
      "Understand the requirements fully",
      "Plan the approach",
      "Execute carefully"
    ],
    "numbered": true
  }
]


json Schema
{
  "$schema": "https://json-schema.org/draft-07/schema",
  "$id": "https://example.com/pom.schema.json",
  "title": "Prompt Object Model",
  "type": "array",
  "items": { "$ref": "#/$defs/section" },
  "$defs": {
    "section": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "body": { "type": "string" },
        "bullets": {
          "type": "array",
          "items": { "type": "string" }
        },
        "subsections": {
          "type": "array",
          "items": { "$ref": "#/$defs/section" }
        },
        "numbered": { "type": "boolean" },
        "numberedBullets": { "type": "boolean" }
      },
      "anyOf": [
        { "required": ["body"] },
        { "required": ["bullets"] }
      ],
      "additionalProperties": false
    }
  }
}