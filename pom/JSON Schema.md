# JSON Schema - What is a schema?

[![Dynamic image](/img/logos/logo-blue.svg)](/)

[Specification](/specification)[Docs](/docs)[Tools](/tools?query=&sortBy=name&sortOrder=ascending&groupBy=toolingTypes&licenses=&languages=&drafts=&toolingTypes=&environments=)[Blog](/blog)[Community](/community)

SearchK

![Dark Mode](/icons/theme-switch.svg)

![System theme](/icons/theme-switch.svg)System

![Light theme](/icons/sun.svg)Light

![Dark theme](/icons/moon.svg)Dark

[Star on GitHub](https://github.com/json-schema-org/json-schema-spec)

### Get started

![eye icon](/icons/eye.svg)

Introduction

![compass icon](/icons/compass.svg)

Get Started

[Overview](/learn)[What is a schema?](/understanding-json-schema/about)[The basics](/understanding-json-schema/basics)[Create your first schema](/learn/getting-started-step-by-step)[Tour of JSON Schema](https://tour.json-schema.org/)[JSON Schema glossary](/learn/glossary)

Examples

[Miscellaneous examples](/learn/miscellaneous-examples)[Modelling a file system](/learn/file-system)[Other examples](/learn/json-schema-examples)

![grad cap icon](/icons/grad-cap.svg)

Guides

![book icon](/icons/book.svg)

Reference

![clipboard icon](/icons/clipboard.svg)

Specification

![eye icon](/icons/eye.svg)

Introduction

![compass icon](/icons/compass.svg)

Get Started

[Overview](/learn)[What is a schema?](/understanding-json-schema/about)[The basics](/understanding-json-schema/basics)[Create your first schema](/learn/getting-started-step-by-step)[Tour of JSON Schema](https://tour.json-schema.org/)[JSON Schema glossary](/learn/glossary)

Examples

[Miscellaneous examples](/learn/miscellaneous-examples)[Modelling a file system](/learn/file-system)[Other examples](/learn/json-schema-examples)

![grad cap icon](/icons/grad-cap.svg)

Guides

![book icon](/icons/book.svg)

Reference

![clipboard icon](/icons/clipboard.svg)

Specification

# What is a schema?

If you've ever used XML Schema, RelaxNG or ASN.1 you probably already know what a schema is and you can happily skip along to the next section. If all that sounds like gobbledygook to you, you've come to the right place. To define what JSON Schema is, we should probably first define what JSON is.

JSON stands for "JavaScript Object Notation", a simple data interchange format. It began as a notation for the world wide web. Since JavaScript exists in most web browsers, and JSON is based on JavaScript, it's very easy to support there. However, it has proven useful enough and simple enough that it is now used in many other contexts that don't involve web surfing.

At its heart, JSON is built on the following data structures:

### object

![Copy icon](/icons/copy.svg "Copy to clipboard")data

{ "key1": "value1", "key2": "value2" }﻿

### array

![Copy icon](/icons/copy.svg "Copy to clipboard")data

\[ "first", "second", "third" \]﻿

### number

![Copy icon](/icons/copy.svg "Copy to clipboard")data

423.1415926﻿

### string

![Copy icon](/icons/copy.svg "Copy to clipboard")data

"This is a string"﻿

### boolean

![Copy icon](/icons/copy.svg "Copy to clipboard")data

true false﻿

### null

![Copy icon](/icons/copy.svg "Copy to clipboard")data

null﻿

These types have [analogs in most programming languages](../understanding-json-schema/reference/type).

With these simple data types, all kinds of structured data can be represented. With that great flexibility comes great responsibility, however, as the same concept could be represented in myriad ways. For example, you could imagine representing information about a person in JSON in different ways:

![Copy icon](/icons/copy.svg "Copy to clipboard")data

{ "name": "George Washington", "birthday": "February 22, 1732", "address": "Mount Vernon, Virginia, United States"} ﻿

![Copy icon](/icons/copy.svg "Copy to clipboard")data

{ "first\_name": "George", "last\_name": "Washington", "birthday": "1732-02-22", "address": { "street\_address": "3200 Mount Vernon Memorial Highway", "city": "Mount Vernon", "state": "Virginia", "country": "United States" }}﻿

Both representations are equally valid, though one is clearly more formal than the other. The design of a record will largely depend on its intended use within the application, so there's no right or wrong answer here. However, when an application says "give me a JSON record for a person", it's important to know exactly how that record should be organized. For example, we need to know what fields are expected, and how the values are represented. That's where JSON Schema comes in. The following JSON Schema fragment describes how the second example above is structured. Don't worry too much about the details for now. They are explained in subsequent chapters.

![Copy icon](/icons/copy.svg "Copy to clipboard") ![ logo-white](/logo-white.svg) schema

{ "type": "object", "properties": { "first\_name": { "type": "string" }, "last\_name": { "type": "string" }, "birthday": { "type": "string", "format": "date" }, "address": { "type": "object", "properties": { "street\_address": { "type": "string" }, "city": { "type": "string" }, "state": { "type": "string" }, "country": { "type" : "string" } } } }}﻿

By "validating" the first example against this schema, you can see that it fails:

![Copy icon](/icons/copy.svg "Copy to clipboard")data

{ "name": "George Washington", "birthday": "February 22, 1732", "address": "Mount Vernon, Virginia, United States"}﻿

![Error icon](/icons/x-mark.svg)not compliant to schema

However, the second example passes:

![Copy icon](/icons/copy.svg "Copy to clipboard")data

{ "first\_name": "George", "last\_name": "Washington", "birthday": "1732-02-22", "address": { "street\_address": "3200 Mount Vernon Memorial Highway", "city": "Mount Vernon", "state": "Virginia", "country": "United States" }}﻿

![Checkmark icon](/icons/checkmark.svg)compliant to schema

You may have noticed that the JSON Schema itself is written in JSON. It is data itself, not a computer program. It's just a declarative format for "describing the structure of other data". This is both its strength and its weakness (which it shares with other similar schema languages). It is easy to concisely describe the surface structure of data, and automate validating data against it. However, since a JSON Schema can't contain arbitrary code, there are certain constraints on the relationships between data elements that can't be expressed. Any "validation tool" for a sufficiently complex data format, therefore, will likely have two phases of validation: one at the schema (or structural) level, and one at the semantic level. The latter check will likely need to be implemented using a more general-purpose programming language.

[

Go Back

Get Started

](/learn)

[

Up Next

The basics

](/understanding-json-schema/basics)

## Need Help?

### Did you find these docs helpful?

### Help us make our docs great!

At JSON Schema, we value docs contributions as much as every other type of contribution!

[Edit this page on Github](https://github.com/json-schema-org/website/blob/main/pages/understanding-json-schema/about.md)

[Learn how to contribute](https://github.com/json-schema-org/website/blob/main/CONTRIBUTING.md)

### Still Need Help?

Learning JSON Schema is often confusing, but don't worry, we are here to help!.

[Ask the community on GitHub](https://github.com/orgs/json-schema-org/discussions/new?category=q-a)

[Ask the community on Slack](https://json-schema.org/slack)