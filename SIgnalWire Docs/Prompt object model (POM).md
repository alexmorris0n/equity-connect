# signalwire-pom · PyPI

# signalwire-pom 2.7.2

pip install signalwire-pom Copy PIP instructions

[Latest version](/project/signalwire-pom/)

Released: Jun 26, 2025

Prompt Object Model - A structured data format for organizing and rendering LLM prompts

### Navigation

### Verified details

_These details have been [verified by PyPI](https://docs.pypi.org/project_metadata/#verified-details)_

###### Maintainers

 [![Avatar for briankwest from gravatar.com](https://pypi-camo.freetls.fastly.net/8e4cb2cb173062868bd48305c65b2848f41f091c/68747470733a2f2f7365637572652e67726176617461722e636f6d2f6176617461722f35666163646533643663663863643537373663386630373032386132623533373f73697a653d3530 "Avatar for briankwest from gravatar.com")briankwest](/user/briankwest/)

### Unverified details

_These details have **not** been verified by PyPI_

###### Project links

-   [Homepage](https://github.com/briankwest/signalwire-pom)
-   [Issues](https://github.com/briankwest/signalwire-pom/issues)

###### Meta

-   **License Expression:** MIT  
    _[SPDX](https://spdx.org/licenses/) [License Expression](https://spdx.github.io/spdx-spec/v3.0.1/annexes/spdx-license-expressions/)_
-   **Author:** [SignalWire](mailto:support@signalwire.com)
-   **Requires:** Python >=3.6

###### Classifiers

-   **Operating System**
    -   [OS Independent](/search/?c=Operating+System+%3A%3A+OS+Independent)
-   **Programming Language**
    -   [Python :: 3](/search/?c=Programming+Language+%3A%3A+Python+%3A%3A+3)

[Report project as malware](https://pypi.org/project/signalwire-pom/submit-malware-report/)

## Project description

# SignalWire Prompt Object Model (POM)

A lightweight Python library for structured prompt management that helps organize and manipulate prompts for large language models (LLMs).

## Installation

pip install signalwire-pom

## Overview

The Prompt Object Model (POM) is a structured data format and accompanying Python SDK for composing, organizing, and rendering prompt instructions for large language models. It provides a tree-based representation of a prompt document composed of nested sections, each of which can include:

-   A title
-   A body of explanatory or instructional text
-   An optional list of bullet points
-   Arbitrarily nested subsections

POM supports multiple output formats including JSON (for machine-readability), Markdown (for human readability), and XML (for structured data exchange), making it ideal for prompt templating, modular editing, and traceable documentation.

## Benefits

Structured prompts are essential when building reliable and maintainable LLM instructions. As your prompts evolve, you may need to insert, remove, or rearrange entire sections, subsections, or even individual bullet points. POM enforces a clear hierarchy and semantic organization to ensure that prompts remain modular, auditable, and easy to extend.

### 1\. Clarity and Structure

Prompts can be clearly divided into reusable sections like `Objective`, `Personality`, `Rules`, `Knowledge`, etc. Each section and subsection can carry detailed instructions and examples.

### 2\. Hierarchical Nesting

Subsections allow nesting of detail and context to any depth, matching how developers and authors think about complex instructions.

### 3\. Markdown Rendering

Documents can be rendered as Markdown with proper heading levels (`##`, `###`, `####`, etc.), which is useful for:

-   Documentation
-   Prompt review and auditing
-   Version control and diffs
-   Direct inclusion in LLM inputs (most modern LLMs are trained to understand and prioritize Markdown structure)

### 4\. JSON Export and Import

The full prompt specification can be exported and rehydrated in JSON for use in automation, testing, and templating pipelines.

### 5\. XML Rendering

POM documents can also be rendered to XML as an alternative to Markdown. This format is especially useful when your LLM is tuned to expect or parse structured XML data.

### 6\. Extensible

The model is designed to be extensible and can easily incorporate metadata, tags, conditions, or versioning as needed.

## Data Structure

Each prompt document consists of a top-level list of `Section` objects. Each `Section` has the following structure:

### Section

-   `title` _(str)_ — The name of the section.
-   `body` _(str, optional)_ — A paragraph of text associated with the section.
-   `bullets` _(list of str, optional)_ — Bullet-pointed items.
-   `subsections` _(list of Section objects)_ — Nested sections with the same structure.
-   `numbered` _(bool, optional)_ — Whether this section should be numbered.
-   `numberedBullets` _(bool, optional)_ — Whether bullets should be numbered.

**Note**: Each section must have at least one of: `body`, `bullets`, or `subsections`. A section containing only a title without any content or nested sections is invalid.

## Usage

from signalwire\_pom import PromptObjectModel

\# Create a new POM
pom \= PromptObjectModel()

\# Add sections with content
overview \= pom.add\_section("Overview", body\="This is an overview of the project.")
overview.add\_bullets(\["Point 1", "Point 2", "Point 3"\])

\# Add subsections
details \= overview.add\_subsection("Details", body\="More detailed information.")
details.add\_bullets(\["Detail 1", "Detail 2"\])

\# Creating sections with only subsections (no body or bullets required)
categories \= pom.add\_section("Categories")
categories.add\_subsection("Type A", body\="First category description")
categories.add\_subsection("Type B", body\="Second category description") 

\# Generate markdown
markdown \= pom.render\_markdown()
print(markdown)

\# Generate JSON representation
json\_data \= pom.to\_json()
print(json\_data)

\# Generate XML representation
xml\_data \= pom.render\_xml()
print(xml\_data)

\# Create from JSON
json\_string \= '''
\[
  {
    "title": "Section from JSON",
    "body": "This section was created from JSON",
    "bullets": \["Bullet 1", "Bullet 2"\],
    "subsections": \[
      {
        "title": "Subsection from JSON",
        "body": "This subsection was created from JSON",
        "bullets": \["Sub-bullet 1", "Sub-bullet 2"\],
        "subsections": \[\]
      }
    \]
  }
\]
'''
loaded\_pom \= PromptObjectModel.from\_json(json\_string)
print(loaded\_pom.render\_markdown())

## Example JSON Representation

{
  "title": "Objective",
  "body": "Define the LLM's purpose in this interaction.",
  "bullets": \["Summarize clearly", "Answer efficiently"\],
  "subsections": \[
    {
      "title": "Main Goal",
      "body": "Provide helpful and concise answers tailored to user intent.",
      "bullets": \[\],
      "subsections": \[\]
    }
  \]
}

## Example XML Representation

<?xml version="1.0" encoding="UTF-8"?>
<prompt>
  <section>
    <title>Objective</title>
    <body>Define the LLM's purpose in this interaction.</body>
    <bullets>
      <bullet>Summarize clearly</bullet>
      <bullet>Answer efficiently</bullet>
    </bullets>
    <subsections>
      <section>
        <title>Main Goal</title>
        <body>Provide helpful and concise answers tailored to user intent.</body>
      </section>
    </subsections>
  </section>
</prompt>

## Example Markdown Output

\## Objective

Define the LLM's purpose in this interaction.

\- Summarize clearly
\- Answer efficiently

\### Main Goal

Provide helpful and concise answers tailored to user intent.

## Features

-   Create structured hierarchical prompts
-   Add sections, subsections, body text, and bullet points
-   Export to markdown, JSON, or XML
-   Import from JSON
-   Find sections by title
-   Numbering support for sections and bullet points

## Intended Use Cases

-   Designing modular prompt templates
-   Explaining prompt logic to collaborators
-   Embedding structured prompt metadata in software systems
-   Managing evolving prompt strategies across products

## License

MIT

## Project details

### Verified details

_These details have been [verified by PyPI](https://docs.pypi.org/project_metadata/#verified-details)_

###### Maintainers

 [![Avatar for briankwest from gravatar.com](https://pypi-camo.freetls.fastly.net/8e4cb2cb173062868bd48305c65b2848f41f091c/68747470733a2f2f7365637572652e67726176617461722e636f6d2f6176617461722f35666163646533643663663863643537373663386630373032386132623533373f73697a653d3530 "Avatar for briankwest from gravatar.com")briankwest](/user/briankwest/)

### Unverified details

_These details have **not** been verified by PyPI_

###### Project links

-   [Homepage](https://github.com/briankwest/signalwire-pom)
-   [Issues](https://github.com/briankwest/signalwire-pom/issues)

###### Meta

-   **License Expression:** MIT  
    _[SPDX](https://spdx.org/licenses/) [License Expression](https://spdx.github.io/spdx-spec/v3.0.1/annexes/spdx-license-expressions/)_
-   **Author:** [SignalWire](mailto:support@signalwire.com)
-   **Requires:** Python >=3.6

###### Classifiers

-   **Operating System**
    -   [OS Independent](/search/?c=Operating+System+%3A%3A+OS+Independent)
-   **Programming Language**
    -   [Python :: 3](/search/?c=Programming+Language+%3A%3A+Python+%3A%3A+3)

  

## Release history [Release notifications](/help/#project-release-notifications) | [RSS feed](/rss/project/signalwire-pom/releases.xml)

This version

![](https://pypi.org/static/images/blue-cube.572a5bfb.svg)

[

2.7.2

Jun 26, 2025

](/project/signalwire-pom/2.7.2/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.7.1

May 12, 2025

](/project/signalwire-pom/2.7.1/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.7

Apr 28, 2025

](/project/signalwire-pom/2.7/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.6

Apr 28, 2025

](/project/signalwire-pom/2.6/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.5

Apr 28, 2025

](/project/signalwire-pom/2.5/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.3

Apr 28, 2025

](/project/signalwire-pom/2.3/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.2

Apr 25, 2025

](/project/signalwire-pom/2.2/)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

[

2.1

Apr 24, 2025

](/project/signalwire-pom/2.1/)

## Download files

Download the file for your platform. If you're not sure which to choose, learn more about [installing packages](https://packaging.python.org/tutorials/installing-packages/ "External link").

### Source Distribution

[signalwire\_pom-2.7.2.tar.gz](https://files.pythonhosted.org/packages/30/69/ebf35b07354e9922123e850e525403df439fbe38838ffa3136905c856dfc/signalwire_pom-2.7.2.tar.gz) (15.3 kB [view details](#signalwire_pom-2.7.2.tar.gz))

Uploaded Jun 26, 2025 `Source`

### Built Distribution

Filter files by name, interpreter, ABI, and platform.

If you're not sure about the file name format, learn more about [wheel file names](https://packaging.python.org/en/latest/specifications/binary-distribution-format/ "External link").

<p class="initial-toggle-visibility"> The dropdown lists show the available interpreters, ABIs, and platforms. </p> <p class="initial-toggle-visibility"> Enable javascript to be able to filter the list of wheel files. </p>

Copy a direct link to the current filters [https://pypi.org/project/signalwire-pom/#files](https://pypi.org/project/signalwire-pom/#files) Copy

Showing 1 of 1 file.

File name 

Interpreter Interpreter py2 py3

ABI ABI none

Platform Platform any

[signalwire\_pom-2.7.2-py2.py3-none-any.whl](https://files.pythonhosted.org/packages/fb/ea/87e9d040c0912d93d2b9ed6b3d1415793e481663c9a7462350df3cfb3bd7/signalwire_pom-2.7.2-py2.py3-none-any.whl) (12.0 kB [view details](#signalwire_pom-2.7.2-py2.py3-none-any.whl))

Uploaded Jun 26, 2025 `Python 2``Python 3`

## File details

Details for the file `signalwire_pom-2.7.2.tar.gz`.

### File metadata

-   Download URL: [signalwire\_pom-2.7.2.tar.gz](https://files.pythonhosted.org/packages/30/69/ebf35b07354e9922123e850e525403df439fbe38838ffa3136905c856dfc/signalwire_pom-2.7.2.tar.gz)
-   Upload date: Jun 26, 2025
-   Size: 15.3 kB
-   Tags: Source
-   Uploaded using Trusted Publishing? No
-   Uploaded via: twine/6.1.0 CPython/3.11.12

### File hashes

Hashes for signalwire\_pom-2.7.2.tar.gz

Algorithm

Hash digest

SHA256

`a62f14b8667ac95ff7085aabc3102fabea729964387c26be676331b5a1bb1dd4`

Copy

MD5

`981d38fd65fd3ee89a097a684f60d333`

Copy

BLAKE2b-256

`3069ebf35b07354e9922123e850e525403df439fbe38838ffa3136905c856dfc`

Copy

[See more details on using hashes here.](https://pip.pypa.io/en/stable/topics/secure-installs/#hash-checking-mode "External link")

## File details

Details for the file `signalwire_pom-2.7.2-py2.py3-none-any.whl`.

### File metadata

-   Download URL: [signalwire\_pom-2.7.2-py2.py3-none-any.whl](https://files.pythonhosted.org/packages/fb/ea/87e9d040c0912d93d2b9ed6b3d1415793e481663c9a7462350df3cfb3bd7/signalwire_pom-2.7.2-py2.py3-none-any.whl)
-   Upload date: Jun 26, 2025
-   Size: 12.0 kB
-   Tags: Python 2, Python 3
-   Uploaded using Trusted Publishing? No
-   Uploaded via: twine/6.1.0 CPython/3.11.12

### File hashes

Hashes for signalwire\_pom-2.7.2-py2.py3-none-any.whl

Algorithm

Hash digest

SHA256

`8cf62c1799c0cebf1b1475d2cebc13cd115dea4aed277a85c6e4c6c43d852cbf`

Copy

MD5

`5b28cd4d1b98af0e06704039f3ac48fb`

Copy

BLAKE2b-256

`fbea87e9d040c0912d93d2b9ed6b3d1415793e481663c9a7462350df3cfb3bd7`

Copy

[See more details on using hashes here.](https://pip.pypa.io/en/stable/topics/secure-installs/#hash-checking-mode "External link")