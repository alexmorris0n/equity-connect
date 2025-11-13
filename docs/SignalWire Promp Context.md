# prompt.contexts

Contexts allow you to create structured conversation flows with multiple specialized paths. Each context represents a distinct conversation mode with its own steps, memory settings, and transition logic.

Every contexts object requires a `default` key, which serves as the entry point for the conversation. You can define additional contexts as custom keys alongside `default`.

| Name               | Type     | Default | Description                                                               |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------- |
| `contexts`Optional | `object` | -       | An object that accepts the [`contexts parameters`](#contexts-parameters). |

## contexts Parameters[​](#contexts-parameters "Direct link to contexts Parameters")

| Name                    | Type     | Default | Description                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`Required       | `object` | -       | The default context to use at the beginning of the conversation. This object accepts the [`context object`](#context-object).                                                                                                                                                                                  |
| `[key: string]`Optional | `object` | -       | Additional contexts to define specialized conversation flows. The key is user-defined and can be any string (e.g., `support`, `sales`, `billing`).<br />These contexts can be accessed from the `default` context or any other user-defined context.<br />Each value is a [`context object`](#context-object). |

## context object[​](#context-object "Direct link to context object")

Each context (both `default` and custom contexts) is configured using a context object with the following properties:

| Name                                                          | Type       | Default | Description                                                                                                                                                                      |
| ------------------------------------------------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`steps`](/swml/methods/ai/prompt/contexts/steps.md) Required | `object[]` | -       | An array of [step objects](/swml/methods/ai/prompt/contexts/steps.md) that define the conversation flow for this context. Steps execute sequentially unless otherwise specified. |
| `isolated`Optional                                            | `boolean`  | `false` | When `true`, resets conversation history to only the system prompt when entering this context. Useful for focused tasks that shouldn't be influenced by previous conversation.   |
| `enter_fillers`Optional                                       | `object[]` | -       | Language-specific filler phrases played when transitioning into this context. Helps provide smooth context switches.                                                             |
| `exit_fillers`Optional                                        | `object[]` | -       | Language-specific filler phrases played when leaving this context. Ensures natural transitions out of specialized modes.                                                         |

### Context Transition Fillers[​](#context-transition-fillers "Direct link to Context Transition Fillers")

The `enter_fillers` and `exit_fillers` properties enhance user experience by providing natural language transitions between contexts. These fillers play automatically during context transitions, support multiple languages, and are randomly selected from provided options to help maintain conversational flow.

#### Filler Structure[​](#filler-structure "Direct link to Filler Structure")

| Language Code   | Type       | Description                                                                                                                                                                    |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[key: string]` | `string[]` | An array of filler phrases for the specified language. The key must be a valid [language code](#supported-language-codes). One phrase is randomly selected during transitions. |

#### Supported Language Codes[​](#supported-language-codes "Direct link to Supported Language Codes")

| Code      | Description                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------ |
| `default` | Default language set by the user in the [`ai.languages`](/swml/methods/ai/languages.md) property |
| `bg`      | Bulgarian                                                                                        |
| `ca`      | Catalan                                                                                          |
| `cs`      | Czech                                                                                            |
| `da`      | Danish                                                                                           |
| `da-DK`   | Danish (Denmark)                                                                                 |
| `de`      | German                                                                                           |
| `de-CH`   | German (Switzerland)                                                                             |
| `el`      | Greek                                                                                            |
| `en`      | English                                                                                          |
| `en-AU`   | English (Australia)                                                                              |
| `en-GB`   | English (United Kingdom)                                                                         |
| `en-IN`   | English (India)                                                                                  |
| `en-NZ`   | English (New Zealand)                                                                            |
| `en-US`   | English (United States)                                                                          |
| `es`      | Spanish                                                                                          |
| `es-419`  | Spanish (Latin America)                                                                          |
| `et`      | Estonian                                                                                         |
| `fi`      | Finnish                                                                                          |
| `fr`      | French                                                                                           |
| `fr-CA`   | French (Canada)                                                                                  |
| `hi`      | Hindi                                                                                            |
| `hu`      | Hungarian                                                                                        |
| `id`      | Indonesian                                                                                       |
| `it`      | Italian                                                                                          |
| `ja`      | Japanese                                                                                         |
| `ko`      | Korean                                                                                           |
| `ko-KR`   | Korean (South Korea)                                                                             |
| `lt`      | Lithuanian                                                                                       |
| `lv`      | Latvian                                                                                          |
| `ms`      | Malay                                                                                            |
| `multi`   | Multilingual (Spanish + English)                                                                 |
| `nl`      | Dutch                                                                                            |
| `nl-BE`   | Flemish (Belgian Dutch)                                                                          |
| `no`      | Norwegian                                                                                        |
| `pl`      | Polish                                                                                           |
| `pt`      | Portuguese                                                                                       |
| `pt-BR`   | Portuguese (Brazil)                                                                              |
| `pt-PT`   | Portuguese (Portugal)                                                                            |
| `ro`      | Romanian                                                                                         |
| `ru`      | Russian                                                                                          |
| `sk`      | Slovak                                                                                           |
| `sv`      | Swedish                                                                                          |
| `sv-SE`   | Swedish (Sweden)                                                                                 |
| `th`      | Thai                                                                                             |
| `th-TH`   | Thai (Thailand)                                                                                  |
| `tr`      | Turkish                                                                                          |
| `uk`      | Ukrainian                                                                                        |
| `vi`      | Vietnamese                                                                                       |
| `zh`      | Chinese (Simplified)                                                                             |
| `zh-CN`   | Chinese (Simplified, China)                                                                      |
| `zh-Hans` | Chinese (Simplified Han)                                                                         |
| `zh-Hant` | Chinese (Traditional Han)                                                                        |
| `zh-HK`   | Chinese (Traditional, Hong Kong)                                                                 |
| `zh-TW`   | Chinese (Traditional, Taiwan)                                                                    |

## Examples[​](#examples "Direct link to Examples")

### Basic Context Structure[​](#basic-context-structure "Direct link to Basic Context Structure")

Here's a simple example showing the context structure with transition fillers:

* YAML
* JSON

```
version: 1.0.0
sections:
  main:
    - ai:
        prompt:
          text: You are a helpful assistant that can switch between different expertise areas.
          contexts:
            default:
              steps:
                - name: greeting
                  text: Greet the user and ask what they need help with. If they need technical support, transfer them to the support context.
                  valid_contexts:
                    - support
            support:
              isolated: true  # Reset conversation history when entering support mode
              enter_fillers:
                - en-US: ["Switching to technical support", "Let me connect you with support"]
                  es-ES: ["Cambiando a soporte técnico", "Permítame conectarlo con soporte"]
              exit_fillers:
                - en-US: ["Leaving support mode", "Returning to main menu"]
                  es-ES: ["Saliendo del modo de soporte", "Volviendo al menú principal"]
              steps:
                - name: troubleshoot
                  text: Help the user troubleshoot their technical issue. When finished, ask if they need anything else or want to return to the main menu.
                  valid_contexts:
                    - default
```

```
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "ai": {
          "prompt": {
            "text": "You are a helpful assistant that can switch between different expertise areas.",
            "contexts": {
              "default": {
                "steps": [
                  {
                    "name": "greeting",
                    "text": "Greet the user and ask what they need help with. If they need technical support, transfer them to the support context.",
                    "valid_contexts": [
                      "support"
                    ]
                  }
                ]
              },
              "support": {
                "isolated": true,
                "enter_fillers": [
                  {
                    "en-US": [
                      "Switching to technical support",
                      "Let me connect you with support"
                    ],
                    "es-ES": [
                      "Cambiando a soporte técnico",
                      "Permítame conectarlo con soporte"
                    ]
                  }
                ],
                "exit_fillers": [
                  {
                    "en-US": [
                      "Leaving support mode",
                      "Returning to main menu"
                    ],
                    "es-ES": [
                      "Saliendo del modo de soporte",
                      "Volviendo al menú principal"
                    ]
                  }
                ],
                "steps": [
                  {
                    "name": "troubleshoot",
                    "text": "Help the user troubleshoot their technical issue. When finished, ask if they need anything else or want to return to the main menu.",
                    "valid_contexts": [
                      "default"
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]
  }
}
```

### Advanced Multi-Context Example[​](#advanced-multi-context-example "Direct link to Advanced Multi-Context Example")

This comprehensive example demonstrates multiple contexts with different AI personalities, voice settings, and specialized knowledge domains:

* YAML
* JSON

```
sections:
  main:
    - ai:
        hints:
          - StarWars
          - StarTrek
        languages:
          - name: Ryan-English
            voice: elevenlabs.patrick
            code: en-US
          - name: Luke-English
            voice: elevenlabs.fin
            code: en-US
          - name: Spock-English
            voice: elevenlabs.charlie
            code: en-US
        prompt:
          text: Help the user transfer to the Star Wars or Star Trek expert.
          contexts:
            default:
              steps:
                - name: start
                  text: |+
                    Your name is Ryan. You are a receptionist. Your only purpose is to change the context to starwars or startrek.
                  step_criteria: |+
                    Introduce yourself as Ryan.
                    Ask the user if he would like to talk to a star wars or star trek expert until they provide an adequate answer.
                - name: transfer
                  text: You will now successfully transfer the user to the Star Wars or Star Trek expert.
                  step_criteria: If the user has chosen a valid context, transfer them to the appropriate expert.
                  valid_contexts:
                    - starwars
                    - startrek
            starwars:
              steps:
                - name: start
                  text: |+
                    The user has been transferred to the Star Wars expert.
                    Until told otherwise, your name is Luke. Change the language to Luke-English.
                    Your current goal is to get the user to tell you their name.
                    Unless told otherwise, refer to the user as 'Padawan {users_name}'.
                  step_criteria: |+
                    Introduce yourself as Luke, the Star Wars expert.
                    The user must tell you their name if they only say one word assume that is their name.
                - name: question
                  text: |+
                    Your goal is to get the user to choose one of the following options.
                    - Jedi Order (advance to jedi_order step)
                    - The ways of the Force (advance to force step)
                    - Talk to the star trek expert. (change context to startrek)
                  step_criteria: +|
                    The user must provide a valid answer to continue.
                    Refer to the user as 'Padawan {users_name}' for the rest of the conversation.
                  valid_steps:
                    - jedi_order
                    - force
                  valid_contexts:
                    - startrek
                - name: jedi_order
                  text: |+
                    Limit the topic to the Jedi Order.
                    Inform the user they can say they want to change the topic at any time, if they do move to the question step.
                  step_criteria: The user says they want to change the topic.
                  valid_steps:
                    - question
                - name: force
                  text: |+
                    Limit the topic to the force.
                    Inform the user they can say they want to change the topic at any time, if they do move to the question step.
                  step_criteria: The user says they want to change the topic.
                  valid_steps:
                    - question
            startrek:
              steps:
                - name: start
                  text: |+
                    The user has been transferred to the Star Trek expert.
                    Until told otherwise, your name is Spok. Change the language to Spok-English.
                    Your current goal is to get the user to tell you their name.
                    Unless told otherwise, refer to the user as 'Ensign {users_name}'.
                  step_criteria: |+
                    Introduce yourself as Spok, the Star Trek expert.
                    The user must tell you their name if they only say one word assume that is their name.
                - name: question
                  text: |+
                    Your goal is to get the user to choose one of the following options.
                    - Vulcan Culture (advance to vulcan_culture step)
                    - Federation (advance to federation step)
                    - Talk to the star wars expert. (change context to starwars)
                  step_criteria: +|
                    The user must provide a valid answer to continue.
                    Refer to the user as 'Ensign {users_name}' for the rest of the conversation.
                  valid_steps:
                    - vulcan_culture
                    - federation
                  valid_contexts:
                    - starwars
                - name: vulcan_culture
                  text: |+
                    Limit the topic to Vulcan Culture.
                    Inform the user they can say they want to change the topic at any time, if they do move to the question step.
                  step_criteria: The user says they want to change the topic.
                  valid_steps:
                    - question
                - name: federation
                  text: |+
                    Limit the topic to the Federation of Planets.
                    Inform the user they can say they want to change the topic at any time, if they do move to the question step.
                  step_criteria: The user says they want to change the topic.
                  valid_steps:
                    - question
```

```
{
  "sections": {
    "main": [
      {
        "ai": {
          "hints": [
            "StarWars",
            "StarTrek"
          ],
          "languages": [
            {
              "name": "Ryan-English",
              "voice": "elevenlabs.patrick",
              "code": "en-US"
            },
            {
              "name": "Luke-English",
              "voice": "elevenlabs.fin",
              "code": "en-US"
            },
            {
              "name": "Spock-English",
              "voice": "elevenlabs.charlie",
              "code": "en-US"
            }
          ],
          "prompt": {
            "text": "Help the user transfer to the Star Wars or Star Trek expert.",
            "contexts": {
              "default": {
                "steps": [
                  {
                    "name": "start",
                    "text": "Your name is Ryan. You are a receptionist. Your only purpose is to change the context to starwars or startrek.\n",
                    "step_criteria": "Introduce yourself as Ryan.\nAsk the user if he would like to talk to a star wars or star trek expert until they provide an adequate answer.\n"
                  },
                  {
                    "name": "transfer",
                    "text": "You will now successfully transfer the user to the Star Wars or Star Trek expert.",
                    "step_criteria": "If the user has chosen a valid context, transfer them to the appropriate expert.",
                    "valid_contexts": [
                      "starwars",
                      "startrek"
                    ]
                  }
                ]
              },
              "starwars": {
                "steps": [
                  {
                    "name": "start",
                    "text": "The user has been transferred to the Star Wars expert.\nUntil told otherwise, your name is Luke. Change the language to Luke-English.\nYour current goal is to get the user to tell you their name.\nUnless told otherwise, refer to the user as 'Padawan {users_name}'.\n",
                    "step_criteria": "Introduce yourself as Luke, the Star Wars expert.\nThe user must tell you their name if they only say one word assume that is their name.\n"
                  },
                  {
                    "name": "question",
                    "text": "Your goal is to get the user to choose one of the following options.\n- Jedi Order (advance to jedi_order step)\n- The ways of the Force (advance to force step)\n- Talk to the star trek expert. (change context to startrek)\n",
                    "step_criteria": "+| The user must provide a valid answer to continue. Refer to the user as 'Padawan {users_name}' for the rest of the conversation.",
                    "valid_steps": [
                      "jedi_order",
                      "force"
                    ],
                    "valid_contexts": [
                      "startrek"
                    ]
                  },
                  {
                    "name": "jedi_order",
                    "text": "Limit the topic to the Jedi Order.\nInform the user they can say they want to change the topic at any time, if they do move to the question step.\n",
                    "step_criteria": "The user says they want to change the topic.",
                    "valid_steps": [
                      "question"
                    ]
                  },
                  {
                    "name": "force",
                    "text": "Limit the topic to the force.\nInform the user they can say they want to change the topic at any time, if they do move to the question step.\n",
                    "step_criteria": "The user says they want to change the topic.",
                    "valid_steps": [
                      "question"
                    ]
                  }
                ]
              },
              "startrek": {
                "steps": [
                  {
                    "name": "start",
                    "text": "The user has been transferred to the Star Trek expert.\nUntil told otherwise, your name is Spok. Change the language to Spok-English.\nYour current goal is to get the user to tell you their name.\nUnless told otherwise, refer to the user as 'Ensign {users_name}'.\n",
                    "step_criteria": "Introduce yourself as Spok, the Star Trek expert.\nThe user must tell you their name if they only say one word assume that is their name.\n"
                  },
                  {
                    "name": "question",
                    "text": "Your goal is to get the user to choose one of the following options.\n- Vulcan Culture (advance to vulcan_culture step)\n- Federation (advance to federation step)\n- Talk to the star wars expert. (change context to starwars)\n",
                    "step_criteria": "+| The user must provide a valid answer to continue. Refer to the user as 'Ensign {users_name}' for the rest of the conversation.",
                    "valid_steps": [
                      "vulcan_culture",
                      "federation"
                    ],
                    "valid_contexts": [
                      "starwars"
                    ]
                  },
                  {
                    "name": "vulcan_culture",
                    "text": "Limit the topic to Vulcan Culture.\nInform the user they can say they want to change the topic at any time, if they do move to the question step.\n",
                    "step_criteria": "The user says they want to change the topic.",
                    "valid_steps": [
                      "question"
                    ]
                  },
                  {
                    "name": "federation",
                    "text": "Limit the topic to the Federation of Planets.\nInform the user they can say they want to change the topic at any time, if they do move to the question step.\n",
                    "step_criteria": "The user says they want to change the topic.",
                    "valid_steps": [
                      "question"
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]
  }
}
```

# contexts.steps

An array of objects that define the steps in the context. These steps are used to define the flow of the conversation.

| Name            | Type       | Default | Description                                                                  |
| --------------- | ---------- | ------- | ---------------------------------------------------------------------------- |
| `steps`Required | `object[]` | -       | An array of objects that accept the [`steps parameters`](#steps-parameters). |

## steps Parameters[​](#steps-parameters "Direct link to steps Parameters")

The `steps` property accepts one of the following step types:

* Text Step
* POM Step

| Name                     | Type       | Default                    | Description                                                                                                                                                                                                                                                                                  |
| :----------------------- | :--------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`Required           | `string`   | -                          | The prompt or instructions given to the AI at this step.                                                                                                                                                                                                                                     |
| `name`Required           | `string`   | -                          | The name of the step. The name must be unique within the context. The name is used for referencing the step in the context.                                                                                                                                                                  |
| `end`Optional            | `boolean`  | `false`                    | A boolean value that determines if the step is the last in the context. If `true`, the context ends after this step.<br />**Important**: This **cannot** be used along with the `valid_steps` parameter.                                                                                     |
| `functions`Optional      | `string[]` | -                          | An array of strings, where each string is the name of a \[SWAIG.function]\[swaig.functions] that can be executed from this step.                                                                                                                                                             |
| `step_criteria`Optional  | `string`   | -                          | The criteria that must be met for the AI to proceed to the next step. The criteria is a instruction given to the AI. It's **highly** recommended you create a custom criteria for the step to get the intended behavior.                                                                     |
| `skip_user_turn`Optional | `boolean`  | `false`                    | A boolean value, if set to `true`, will skip the user's turn to respond in the conversation and proceed to the next step.                                                                                                                                                                    |
| `valid_contexts`Optional | `string[]` | -                          | An array of context names that the AI can transition to from this step. This must be a valid `contexts.name` that is present in your [`contexts`](/swml/methods/ai/prompt/contexts/steps.md) object.                                                                                         |
| `valid_steps`Optional    | `string[]` | Proceeds to the next step. | An array of valid step names that the conversation can proceed to from this step. If the array is empty, or the `valid_steps` key is not present, the conversation will proceed to the next step in the context.<br />**Important**: This **cannot** be used along with the `end` parameter. |

| Name                     | Type       | Default                    | Description                                                                                                                                                                                                                                                                                  |
| :----------------------- | :--------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pom`Required            | `object[]` | -                          | An array of [POM (Prompt Object Model)](/swml/methods/ai/prompt/pom.md) sections that define structured prompt instructions for the AI at this step.                                                                                                                                         |
| `name`Required           | `string`   | -                          | The name of the step. The name must be unique within the context. The name is used for referencing the step in the context.                                                                                                                                                                  |
| `end`Optional            | `boolean`  | `false`                    | A boolean value that determines if the step is the last in the context. If `true`, the context ends after this step.<br />**Important**: This **cannot** be used along with the `valid_steps` parameter.                                                                                     |
| `functions`Optional      | `string[]` | -                          | An array of strings, where each string is the name of a \[SWAIG.function]\[swaig.functions] that can be executed from this step.                                                                                                                                                             |
| `step_criteria`Optional  | `string`   | -                          | The criteria that must be met for the AI to proceed to the next step. The criteria is a instruction given to the AI. It's **highly** recommended you create a custom criteria for the step to get the intended behavior.                                                                     |
| `skip_user_turn`Optional | `boolean`  | `false`                    | A boolean value, if set to `true`, will skip the user's turn to respond in the conversation and proceed to the next step.                                                                                                                                                                    |
| `valid_contexts`Optional | `string[]` | -                          | An array of context names that the AI can transition to from this step. This must be a valid `contexts.name` that is present in your [`contexts`](/swml/methods/ai/prompt/contexts/steps.md) object.                                                                                         |
| `valid_steps`Optional    | `string[]` | Proceeds to the next step. | An array of valid step names that the conversation can proceed to from this step. If the array is empty, or the `valid_steps` key is not present, the conversation will proceed to the next step in the context.<br />**Important**: This **cannot** be used along with the `end` parameter. |
