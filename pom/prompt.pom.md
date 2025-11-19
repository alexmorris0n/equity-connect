# prompt.pom | SignalWire Docs

On this page

# prompt.pom

## Prompt Object Model (POM)[​](#prompt-object-model-pom "Direct link to Prompt Object Model (POM)")

The prompt object model (POM) is a structured data format designed for composing, organizing, and rendering prompt instructions for AI agents. POM helps users create prompts that are clearly structured and easy to understand. It allows for efficient editing, management, and maintenance of prompts. By breaking prompts into sections, users can manage each section independently and then combine them into a single cohesive prompt.

SignalWire will render the prompt into a markdown document.

If the `text` parameter is present while using `pom`, the `pom` prompt will be used instead of `text`.

Want a library for working with the POM?

SignalWire provides a Python library for working with the POM. More information can be found in the [POM reference](/ai/pom).

Name

Type

Default

Description

`pom`Optional

`object[]`

\-

An array of objects that defines the prompt object model (POM) for the AI. Each object represents a [`section`](#section) in the POM.

## Section parameters[​](#section "Direct link to Section parameters")

Each section can contain one of the two valid objects. One of `body` or `bullets` or pass both is required.

Name

Type

Default

Description

`title`Optional

`string`

\-

The title of the section. Will be a heading in the rendered prompt.

`body`Conditionally Required

`string`

\-

The body of the section. This will be a paragraph in the rendered prompt. This parameter is required if `bullets` is not present.

`bullets`Conditionally Required

`string[]`

\-

An array of strings that represent the bullets of the section. This will be a list of short statements/rules in the rendered prompt. This parameter is `optional` if `body` is present.

`subsections`Optional

`object[]`

\-

An array of objects that defines the prompt object model (POM) for the AI. Each object represents a `section` in the POM allowing the users to nest sections within sections.

`numbered`Optional

`boolean`

`false`

If `true`, the section will be numbered in the rendered prompt.

`numberedBullets`Optional

`boolean`

`false`

If `true`, the bullets will be numbered in the rendered prompt.

## Example[​](#example "Direct link to Example")

Below is an example of using the POM to create a prompt.

-   YAML
-   JSON

```
version: 1.0.0sections:  main:    - ai:        prompt:          text: "Prompt is defined in pom"          pom:            - title: "Agent Personality"              body: "You are a friendly and engaging assistant. Keep the conversation light and fun."              subsections:                 - title: "Personal Information"                  numberedBullets: true                  bullets:                    - "You are a AI Agent"                    - "Your name is Frank"                    - "You work at SignalWire"            - title: "Task"              body: "You are to ask the user a series of questions to gather information."              bullets:                 - "Ask the user to provide their name"                - "Ask the user to provide their favorite color"                - "Ask the user to provide their favorite food"                - "Ask the user to provide their favorite movie"                - "Ask the user to provide their favorite TV show"                - "Ask the user to provide their favorite music"                - "Ask the user to provide their favorite sport"                - "Ask the user to provide their favorite animal"
```

```
{  "version": "1.0.0",  "sections": {    "main": [      {        "ai": {          "prompt": {            "text": "Prompt is defined in pom",            "pom": [              {                "title": "Agent Personality",                "body": "You are a friendly and engaging assistant. Keep the conversation light and fun.",                "subsections": [                  {                    "title": "Personal Information",                    "numberedBullets": true,                    "bullets": [                      "You are a AI Agent",                      "Your name is Frank",                      "You work at SignalWire"                    ]                  }                ]              },              {                "title": "Task",                "body": "You are to ask the user a series of questions to gather information.",                "bullets": [                  "Ask the user to provide their name",                  "Ask the user to provide their favorite color",                  "Ask the user to provide their favorite food",                  "Ask the user to provide their favorite movie",                  "Ask the user to provide their favorite TV show",                  "Ask the user to provide their favorite music",                  "Ask the user to provide their favorite sport",                  "Ask the user to provide their favorite animal"                ]              }            ]          }        }      }    ]  }}
```

### Rendered Prompt[​](#rendered-prompt "Direct link to Rendered Prompt")

The above example will render the following prompt:

```
## Agent PersonalityYou are a friendly and engaging assistant. Keep the conversation light and fun.### Personal Information1. You are a AI Agent2. Your name is Frank3. You work at SignalWire## TaskYou are to ask the user a series of questions to gather information.- Ask the user to provide their name- Ask the user to provide their favorite color- Ask the user to provide their favorite food- Ask the user to provide their favorite movie- Ask the user to provide their favorite TV show- Ask the user to provide their favorite music- Ask the user to provide their favorite sport- Ask the user to provide their favorite animal
```

**Was this helpful?**

- [prompt.pom | SignalWire Docs](#promptpom--signalwire-docs)
- [prompt.pom](#promptpom)
  - [Prompt Object Model (POM)​](#prompt-object-model-pom)
  - [Section parameters​](#section-parameters)
  - [Example​](#example)
    - [Rendered Prompt​](#rendered-prompt)
  - [Embedded Content](#embedded-content)

## Embedded Content

<iframe height="0" width="0" src="https://www.googletagmanager.com/static/service_worker/5ba0/sw_iframe.html?origin=https%3A%2F%2Fdeveloper.signalwire.com" style="display: none; visibility: hidden;"></iframe>