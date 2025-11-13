# Rime

Text-to-speech

<br />

<br />

<!-- -->

![Rime's logo.](/assets/images/rime-plus-sw-2c6315361547be9d40bb76d35787c9f9.png)

Rime voices are live on the SignalWire platform! Read on to learn about the available models, and try out Arcana voices with a SignalWire Voice AI Agent.

## Models[​](#models "Direct link to Models")

### Mist v2[​](#mist-v2 "Direct link to Mist v2")

Mist is Rime’s fastest model, built for high-volume, business-critical applications. Rime's fastest and most precise voices help you convert prospects, retain customers, and drive sales by ensuring your message resonates exactly as intended.

## [Rime models<!-- -->](https://docs.rime.ai/api-reference/models)

[View Rime's model reference](https://docs.rime.ai/api-reference/models)

### Arcana[​](#arcana "Direct link to Arcana")

Arcana is Rime's latest and greatest model, offering a variety of ultra-realistic voices. These voices prioritize authenticity and character, capturing natural rhythms and tiny imperfections that make voices sound human. Perfect for creative applications where realism is a top priority.

## [Arcana<!-- -->](https://www.rime.ai/blog/introducing-arcana/)

[Read Rime's announcement blog post](https://www.rime.ai/blog/introducing-arcana/)

## Voices[​](#voices "Direct link to Voices")

Mist v2 is the default Rime model on the SignalWire platform. To use this model, simply set the voice ID.

To use Arcana voices, set `model` to `arcana` with the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method:

```
languages:
- name: English
  code: en-US
  voice: rime.luna
  model: arcana
```

For a full demonstration and sample script, see below.

## [Rime dashboard<!-- -->](https://app.rime.ai/)

[Preview Rime voices on their dashboard](https://app.rime.ai/)

## [Rime docs<!-- -->](https://docs.rime.ai/api-reference/voices)

[Refer to the Rime Docs for an up-to-date list of voice IDs.](https://docs.rime.ai/api-reference/voices)

## Build with Rime on SignalWire[​](#build-with-rime-on-signalwire "Direct link to Build with Rime on SignalWire")

### Create a Space and add credit[​](#create-a-space-and-add-credit "Direct link to Create a Space and add credit")

If you don't have one yet, you'll need to [create a SignalWire Space](/platform/dashboard/getting-started/signing-up-for-a-space.md). Be sure to [add some credit](/platform/dashboard/billing.md#trial-mode) to test with.

### Add a new Resource[​](#add-a-new-resource "Direct link to Add a new Resource")

Find the **Resources** tab in the main sidebar menu of your Dashboard.

![The Resources tab of the SignalWire Dashboard.](/assets/images/home-resources-marked-0fdf33418f0af9b0c9b7643f9a5913e0.png)

Create and manage all Resources from the SignalWire Dashboard.

![A list of Resources in a SignalWire Space.](/assets/images/resource-list-bc571cf054ffaa194a92837989b0bd03.webp)

## [Resources<!-- -->](/platform/call-fabric/resources.md)

[Learn more about Resources, the interoperable communications building blocks that interact with Subscribers in SignalWire's Call Fabric architecture.](/platform/call-fabric/resources.md)

### Create a SWML Script[​](#create-a-swml-script "Direct link to Create a SWML Script")

From the Resources menu, select **SWML Script**. Name it something fun and recognizable. Ours is titled Rime Wizard.

Next, paste the following starter script into the text box, and hit `Save`:

* YAML
* JSON

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: | 
          You're Luna, a voice from Rime's Arcana model! 
          Introduce yourself, and have a conversation about programmable unified communications on the SignalWire platform. 
      languages:
      - name: English
        code: en-US
        voice: rime.luna
        model: arcana
```

```
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "ai": {
          "prompt": {
            "text": "You're Luna, a voice from Rime's Arcana model! \nIntroduce yourself, and have a conversation about programmable unified communications on the SignalWire platform. \n"
          },
          "languages": [
            {
              "name": "English",
              "code": "en-US",
              "voice": "rime.luna",
              "model": "arcana"
            }
          ]
        }
      }
    ]
  }
}
```

### Buy and assign a phone number[​](#buy-and-assign-a-phone-number "Direct link to Buy and assign a phone number")

Navigate to the **Phone Numbers** section of the Dashboard's left sidebar menu.

Purchase a phone number and assign it to the desired SWML script.

![A purchased phone number showing assignment to a specified Resource.](/assets/images/assign-resource-voice-fb2e09b4dc0bba4fce3b73af69f67b85.png)

Assigning a phone number to the SWML Script

### Give it a call\![​](#give-it-a-call "Direct link to Give it a call!")

Call the number you just assigned to chat with your new AI voice application on the phone.

## Next steps with SWML[​](#next-steps-with-swml "Direct link to Next steps with SWML")

Now you've deployed your very first SignalWire voice AI application using Rime voices. Next, dive deeper into SWML to explore its capabilities!

## [Methods reference<!-- -->](/swml.md)

[Documentation for all SWML methods](/swml.md)

## [AI in SWML<!-- -->](/swml/guides/ai.md)

[Build advanced AI applications using SignalWire Markup Language](/swml/guides/ai.md)

## [Guides<!-- -->](/swml/guides.md)

[SWML guides and demo applications](/swml/guides.md)

# Amazon Polly

Amazon Web Services' Polly TTS engine includes several models to accommodate different use cases.

## Models[​](#models "Direct link to Models")

SignalWire supports the following three Amazon models.

## [Standard<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/standard-voices.html)

[Polly Standard is a traditional, cost-effective, and reliable TTS model.](https://docs.aws.amazon.com/polly/latest/dg/standard-voices.html)

[Example voice ID string: `amazon.Emma:en-GB` or `amazon.Emma:standard:en-GB`](https://docs.aws.amazon.com/polly/latest/dg/standard-voices.html)

## [Neural<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html)

[Polly Neural produces more natural, human-like speech than Polly Standard.](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html)

[Example voice ID string: `amazon.Kendra:neural:en-US`](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html)

## [Generative<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html)

[Polly Generative is Amazon's largest and most realistic model.](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html)

[Example voice ID string: `amazon.Danielle:generative:en-US`](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html)

## Languages[​](#languages "Direct link to Languages")

Consult AWS documentation for a comprehensive and up-to-date list of supported voices, as well as information on accented and fully bilingual voices.

## [List of supported voices<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)

[Most Amazon Polly voices support a single language. Select voices from this list, which includes Standard, Neural, and Generative models.](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)

## [Bilingual pronunciation<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/bilingual-voices.html#accented-bilingual)

[All Amazon Polly voices support accented bilingual pronunciation through the use of the SSML `lang` tag.](https://docs.aws.amazon.com/polly/latest/dg/bilingual-voices.html#accented-bilingual)

## [Fully bilingual voices<!-- -->](https://docs.aws.amazon.com/polly/latest/dg/bilingual-voices.html#true-bilingual)

[Learn more about fully bilingual voices like `Aditi`, `Kajal`, `Hala`, and `Zayd`, which are designed to fluently speak two languages.](https://docs.aws.amazon.com/polly/latest/dg/bilingual-voices.html#true-bilingual)

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

Amazon voice IDs are composed of four sections:

| Parameter                | Possible values                                                                                                                               | Description                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `engine`<br />required   | - `amazon`<br />- `polly` (will be deprecated in the future)                                                                                  | TTS engine                              |
| `voice`<br />required    | Choose from the [**Name/ID** column](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html "Available Amazon Polly voices")       | Voice ID                                |
| `model`<br />optional    | `standard`, `neural`, or `generative`                                                                                                         | Amazon Polly model. Default: `standard` |
| `language`<br />optional | Choose from the [**Language code** column](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html "Available Amazon Polly voices") | Sets model language. Default: `en-US`   |

Create the voice string according to the following pattern:

```
amazon.voice:model:language
```

### Examples[​](#examples "Direct link to Examples")

```
# The Danielle voice, which supports the default Standard model and en-US language
amazon.Danielle

# Two equivalent strings for the Standard-model Aditi bilingual voice in the Hindi language
amazon.Aditi:standard:hi-IN
amazon.Aditi:hi-IN

# The Amy Generative model in British English
amazon.Amy:generative:en-GB
```

note

The `polly` engine code is being deprecated. Use `amazon` instead.

Character limits

Amazon Polly has a limit of 3000 chargeable characters in a single request. If your TTS request is longer than 3000 characters, you will experience silence.

***

## Examples[​](#examples-1 "Direct link to Examples")

See how to use Amazon Polly voices on the SignalWire platform.

* SWML
* RELAY Realtime SDK
* Call Flow Builder
* cXML

Use the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method to set one or more voices for an [AI agent](/swml/methods/ai.md).

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: Have an open-ended conversation about flowers.
      languages:
        - name: English
          code: en-US
          voice: amazon.Ruth:neural
```

Alternatively, use the [**`say_voice`** parameter](/swml/methods/play.md#parameters) of the [**`play`**](/swml/methods/play.md) SWML method to select a voice for basic TTS.

```
version: 1.0.0
sections:
  main:
  - set:
      say_voice: "amazon.Ruth:neural"
  - play: "say:Greetings. This is the Ruth voice from Amazon Polly's Neural text-to-speech model."
```

```
// This example uses the Node.js SDK for SignalWire's RELAY Realtime API.
const playback = await call.playTTS({ 
    text: "Greetings. This is the Ruth voice from Amazon Polly's Neural text-to-speech model.",
    voice: "amazon.Ruth:neural",
});
await playback.ended();
```

![The Call Flow Builder interface. A voice is selected in the drop-down menu.](/assets/images/polly-cfb-voice-213bafa13a095946b3be72717f05f016.webp)

```
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="amazon.Ruth:neural">
    Greetings. This is the Ruth voice from Amazon Polly's Neural text-to-speech model.
</Say>
</Response>
```

# Microsoft Azure

Microsoft's Azure platform offers an impressive array of high-quality, multilingual voices in its Neural model.

## Languages[​](#languages "Direct link to Languages")

Azure Neural voices are interchangeably compatible with all supported languages. Rather than setting language with the language `code`, simply provide input text in the desired language.

Consult the Azure [supported languages resource](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) for an up-to-date list of supported languages.

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

| Voice codes                           |
| ------------------------------------- |
| `af-ZA-AdriNeural`                    |
| `af-ZA-WillemNeural`                  |
| `am-ET-MekdesNeural`                  |
| `am-ET-AmehaNeural`                   |
| `ar-AE-FatimaNeural`                  |
| `ar-AE-HamdanNeural`                  |
| `ar-BH-LailaNeural`                   |
| `ar-BH-AliNeural`                     |
| `ar-DZ-AminaNeural`                   |
| `ar-DZ-IsmaelNeural`                  |
| `ar-EG-SalmaNeural`                   |
| `ar-EG-ShakirNeural`                  |
| `ar-IQ-RanaNeural`                    |
| `ar-IQ-BasselNeural`                  |
| `ar-JO-SanaNeural`                    |
| `ar-JO-TaimNeural`                    |
| `ar-KW-NouraNeural`                   |
| `ar-KW-FahedNeural`                   |
| `ar-LB-LaylaNeural`                   |
| `ar-LB-RamiNeural`                    |
| `ar-LY-ImanNeural`                    |
| `ar-LY-OmarNeural`                    |
| `ar-MA-MounaNeural`                   |
| `ar-MA-JamalNeural`                   |
| `ar-OM-AyshaNeural`                   |
| `ar-OM-AbdullahNeural`                |
| `ar-QA-AmalNeural`                    |
| `ar-QA-MoazNeural`                    |
| `ar-SA-ZariyahNeural`                 |
| `ar-SA-HamedNeural`                   |
| `ar-SY-AmanyNeural`                   |
| `ar-SY-LaithNeural`                   |
| `ar-TN-ReemNeural`                    |
| `ar-TN-HediNeural`                    |
| `ar-YE-MaryamNeural`                  |
| `ar-YE-SalehNeural`                   |
| `as-IN-YashicaNeural`                 |
| `as-IN-PriyomNeural`                  |
| `az-AZ-BanuNeural`                    |
| `az-AZ-BabekNeural`                   |
| `bg-BG-KalinaNeural`                  |
| `bg-BG-BorislavNeural`                |
| `bn-BD-NabanitaNeural`                |
| `bn-BD-PradeepNeural`                 |
| `bn-IN-TanishaaNeural`                |
| `bn-IN-BashkarNeural`                 |
| `bs-BA-VesnaNeural`                   |
| `bs-BA-GoranNeural`                   |
| `ca-ES-JoanaNeural`                   |
| `ca-ES-EnricNeural`                   |
| `ca-ES-AlbaNeural`                    |
| `cs-CZ-VlastaNeural`                  |
| `cs-CZ-AntoninNeural`                 |
| `cy-GB-NiaNeural`                     |
| `cy-GB-AledNeural`                    |
| `da-DK-ChristelNeural`                |
| `da-DK-JeppeNeural`                   |
| `de-AT-IngridNeural`                  |
| `de-AT-JonasNeural`                   |
| `de-CH-LeniNeural`                    |
| `de-CH-JanNeural`                     |
| `de-DE-KatjaNeural`                   |
| `de-DE-ConradNeural`                  |
| `de-DE-SeraphinaMultilingualNeural`   |
| `de-DE-FlorianMultilingualNeural`     |
| `de-DE-AmalaNeural`                   |
| `de-DE-BerndNeural`                   |
| `de-DE-ChristophNeural`               |
| `de-DE-ElkeNeural`                    |
| `de-DE-GiselaNeural`                  |
| `de-DE-KasperNeural`                  |
| `de-DE-KillianNeural`                 |
| `de-DE-KlarissaNeural`                |
| `de-DE-KlausNeural`                   |
| `de-DE-LouisaNeural`                  |
| `de-DE-MajaNeural`                    |
| `de-DE-RalfNeural`                    |
| `de-DE-TanjaNeural`                   |
| `el-GR-AthinaNeural`                  |
| `el-GR-NestorasNeural`                |
| `en-AU-NatashaNeural`                 |
| `en-AU-WilliamNeural`                 |
| `en-AU-AnnetteNeural`                 |
| `en-AU-CarlyNeural`                   |
| `en-AU-DarrenNeural`                  |
| `en-AU-DuncanNeural`                  |
| `en-AU-ElsieNeural`                   |
| `en-AU-FreyaNeural`                   |
| `en-AU-JoanneNeural`                  |
| `en-AU-KenNeural`                     |
| `en-AU-KimNeural`                     |
| `en-AU-NeilNeural`                    |
| `en-AU-TimNeural`                     |
| `en-AU-TinaNeural`                    |
| `en-CA-ClaraNeural`                   |
| `en-CA-LiamNeural`                    |
| `en-GB-SoniaNeural`                   |
| `en-GB-RyanNeural`                    |
| `en-GB-LibbyNeural`                   |
| `en-GB-AdaMultilingualNeural`         |
| `en-GB-OllieMultilingualNeural`       |
| `en-GB-AbbiNeural`                    |
| `en-GB-AlfieNeural`                   |
| `en-GB-BellaNeural`                   |
| `en-GB-ElliotNeural`                  |
| `en-GB-EthanNeural`                   |
| `en-GB-HollieNeural`                  |
| `en-GB-MaisieNeural`                  |
| `en-GB-NoahNeural`                    |
| `en-GB-OliverNeural`                  |
| `en-GB-OliviaNeural`                  |
| `en-GB-ThomasNeural`                  |
| `en-GB-MiaNeural`                     |
| `en-HK-YanNeural`                     |
| `en-HK-SamNeural`                     |
| `en-IE-EmilyNeural`                   |
| `en-IE-ConnorNeural`                  |
| `en-IN-AaravNeural`                   |
| `en-IN-AashiNeural`                   |
| `en-IN-AnanyaNeural`                  |
| `en-IN-KavyaNeural`                   |
| `en-IN-KunalNeural`                   |
| `en-IN-NeerjaNeural`                  |
| `en-IN-PrabhatNeural`                 |
| `en-IN-RehaanNeural`                  |
| `en-KE-AsiliaNeural`                  |
| `en-KE-ChilembaNeural`                |
| `en-NG-EzinneNeural`                  |
| `en-NG-AbeoNeural`                    |
| `en-NZ-MollyNeural`                   |
| `en-NZ-MitchellNeural`                |
| `en-PH-RosaNeural`                    |
| `en-PH-JamesNeural`                   |
| `en-SG-LunaNeural`                    |
| `en-SG-WayneNeural`                   |
| `en-TZ-ImaniNeural`                   |
| `en-TZ-ElimuNeural`                   |
| `en-US-AvaMultilingualNeural`         |
| `en-US-AndrewMultilingualNeural`      |
| `en-US-EmmaMultilingualNeural`        |
| `en-US-BrianMultilingualNeural`       |
| `en-US-AvaNeural`                     |
| `en-US-AndrewNeural`                  |
| `en-US-EmmaNeural`                    |
| `en-US-BrianNeural`                   |
| `en-US-JennyNeural`                   |
| `en-US-GuyNeural`                     |
| `en-US-AriaNeural`                    |
| `en-US-DavisNeural`                   |
| `en-US-JaneNeural`                    |
| `en-US-JasonNeural`                   |
| `en-US-KaiNeural`                     |
| `en-US-LunaNeural`                    |
| `en-US-SaraNeural`                    |
| `en-US-TonyNeural`                    |
| `en-US-NancyNeural`                   |
| `en-US-CoraMultilingualNeural`        |
| `en-US-ChristopherMultilingualNeural` |
| `en-US-BrandonMultilingualNeural`     |
| `en-US-AmberNeural`                   |
| `en-US-AnaNeural`                     |
| `en-US-AshleyNeural`                  |
| `en-US-BrandonNeural`                 |
| `en-US-ChristopherNeural`             |
| `en-US-CoraNeural`                    |
| `en-US-ElizabethNeural`               |
| `en-US-EricNeural`                    |
| `en-US-JacobNeural`                   |
| `en-US-JennyMultilingualNeural`       |
| `en-US-MichelleNeural`                |
| `en-US-MonicaNeural`                  |
| `en-US-RogerNeural`                   |
| `en-US-RyanMultilingualNeural`        |
| `en-US-SteffanNeural`                 |
| `en-ZA-LeahNeural`                    |
| `en-ZA-LukeNeural`                    |
| `es-AR-ElenaNeural`                   |
| `es-AR-TomasNeural`                   |
| `es-BO-SofiaNeural`                   |
| `es-BO-MarceloNeural`                 |
| `es-CL-CatalinaNeural`                |
| `es-CL-LorenzoNeural`                 |
| `es-CO-SalomeNeural`                  |
| `es-CO-GonzaloNeural`                 |
| `es-CR-MariaNeural`                   |
| `es-CR-JuanNeural`                    |
| `es-CU-BelkysNeural`                  |
| `es-CU-ManuelNeural`                  |
| `es-DO-RamonaNeural`                  |
| `es-DO-EmilioNeural`                  |
| `es-EC-AndreaNeural`                  |
| `es-EC-LuisNeural`                    |
| `es-ES-ElviraNeural`                  |
| `es-ES-AlvaroNeural`                  |
| `es-ES-ArabellaMultilingualNeural`    |
| `es-ES-IsidoraMultilingualNeural`     |
| `es-ES-TristanMultilingualNeural`     |
| `es-ES-XimenaMultilingualNeural`      |
| `es-ES-AbrilNeural`                   |
| `es-ES-ArnauNeural`                   |
| `es-ES-DarioNeural`                   |
| `es-ES-EliasNeural`                   |
| `es-ES-EstrellaNeural`                |
| `es-ES-IreneNeural`                   |
| `es-ES-LaiaNeural`                    |
| `es-ES-LiaNeural`                     |
| `es-ES-NilNeural`                     |
| `es-ES-SaulNeural`                    |
| `es-ES-TeoNeural`                     |
| `es-ES-TrianaNeural`                  |
| `es-ES-VeraNeural`                    |
| `es-ES-XimenaNeural`                  |
| `es-GQ-TeresaNeural`                  |
| `es-GQ-JavierNeural`                  |
| `es-GT-MartaNeural`                   |
| `es-GT-AndresNeural`                  |
| `es-HN-KarlaNeural`                   |
| `es-HN-CarlosNeural`                  |
| `es-MX-DaliaNeural`                   |
| `es-MX-JorgeNeural`                   |
| `es-MX-BeatrizNeural`                 |
| `es-MX-CandelaNeural`                 |
| `es-MX-CarlotaNeural`                 |
| `es-MX-CecilioNeural`                 |
| `es-MX-GerardoNeural`                 |
| `es-MX-LarissaNeural`                 |
| `es-MX-LibertoNeural`                 |
| `es-MX-LucianoNeural`                 |
| `es-MX-MarinaNeural`                  |
| `es-MX-NuriaNeural`                   |
| `es-MX-PelayoNeural`                  |
| `es-MX-RenataNeural`                  |
| `es-MX-YagoNeural`                    |
| `es-NI-YolandaNeural`                 |
| `es-NI-FedericoNeural`                |
| `es-PA-MargaritaNeural`               |
| `es-PA-RobertoNeural`                 |
| `es-PE-CamilaNeural`                  |
| `es-PE-AlexNeural`                    |
| `es-PR-KarinaNeural`                  |
| `es-PR-VictorNeural`                  |
| `es-PY-TaniaNeural`                   |
| `es-PY-MarioNeural`                   |
| `es-SV-LorenaNeural`                  |
| `es-SV-RodrigoNeural`                 |
| `es-US-PalomaNeural`                  |
| `es-US-AlonsoNeural`                  |
| `es-UY-ValentinaNeural`               |
| `es-UY-MateoNeural`                   |
| `es-VE-PaolaNeural`                   |
| `es-VE-SebastianNeural`               |
| `et-EE-AnuNeural`                     |
| `et-EE-KertNeural`                    |
| `eu-ES-AinhoaNeural`                  |
| `eu-ES-AnderNeural`                   |
| `fa-IR-DilaraNeural`                  |
| `fa-IR-FaridNeural`                   |
| `fi-FI-SelmaNeural`                   |
| `fi-FI-HarriNeural`                   |
| `fi-FI-NooraNeural`                   |
| `fil-PH-BlessicaNeural`               |
| `fil-PH-AngeloNeural`                 |
| `fr-BE-CharlineNeural`                |
| `fr-BE-GerardNeural`                  |
| `fr-CA-SylvieNeural`                  |
| `fr-CA-JeanNeural`                    |
| `fr-CA-AntoineNeural`                 |
| `fr-CA-ThierryNeural`                 |
| `fr-CH-ArianeNeural`                  |
| `fr-CH-FabriceNeural`                 |
| `fr-FR-DeniseNeural`                  |
| `fr-FR-HenriNeural`                   |
| `fr-FR-VivienneMultilingualNeural`    |
| `fr-FR-RemyMultilingualNeural`        |
| `fr-FR-LucienMultilingualNeural`      |
| `fr-FR-AlainNeural`                   |
| `fr-FR-BrigitteNeural`                |
| `fr-FR-CelesteNeural`                 |
| `fr-FR-ClaudeNeural`                  |
| `fr-FR-CoralieNeural`                 |
| `fr-FR-EloiseNeural`                  |
| `fr-FR-JacquelineNeural`              |
| `fr-FR-JeromeNeural`                  |
| `fr-FR-JosephineNeural`               |
| `fr-FR-MauriceNeural`                 |
| `fr-FR-YvesNeural`                    |
| `fr-FR-YvetteNeural`                  |
| `ga-IE-OrlaNeural`                    |
| `ga-IE-ColmNeural`                    |
| `gl-ES-SabelaNeural`                  |
| `gl-ES-RoiNeural`                     |
| `gu-IN-DhwaniNeural`                  |
| `gu-IN-NiranjanNeural`                |
| `he-IL-HilaNeural`                    |
| `he-IL-AvriNeural`                    |
| `hi-IN-AaravNeural`                   |
| `hi-IN-AnanyaNeural`                  |
| `hi-IN-KavyaNeural`                   |
| `hi-IN-KunalNeural`                   |
| `hi-IN-RehaanNeural`                  |
| `hi-IN-SwaraNeural`                   |
| `hi-IN-MadhurNeural`                  |
| `hr-HR-GabrijelaNeural`               |
| `hr-HR-SreckoNeural`                  |
| `hu-HU-NoemiNeural`                   |
| `hu-HU-TamasNeural`                   |
| `hy-AM-AnahitNeural`                  |
| `hy-AM-HaykNeural`                    |
| `id-ID-GadisNeural`                   |
| `id-ID-ArdiNeural`                    |
| `is-IS-GudrunNeural`                  |
| `is-IS-GunnarNeural`                  |
| `it-IT-ElsaNeural`                    |
| `it-IT-IsabellaNeural`                |
| `it-IT-DiegoNeural`                   |
| `it-IT-AlessioMultilingualNeural`     |
| `it-IT-IsabellaMultilingualNeural`    |
| `it-IT-GiuseppeMultilingualNeural`    |
| `it-IT-MarcelloMultilingualNeural`    |
| `it-IT-BenignoNeural`                 |
| `it-IT-CalimeroNeural`                |
| `it-IT-CataldoNeural`                 |
| `it-IT-FabiolaNeural`                 |
| `it-IT-FiammaNeural`                  |
| `it-IT-GianniNeural`                  |
| `it-IT-GiuseppeNeural`                |
| `it-IT-ImeldaNeural`                  |
| `it-IT-IrmaNeural`                    |
| `it-IT-LisandroNeural`                |
| `it-IT-PalmiraNeural`                 |
| `it-IT-PierinaNeural`                 |
| `it-IT-RinaldoNeural`                 |
| `iu-Cans-CA-SiqiniqNeural`            |
| `iu-Cans-CA-TaqqiqNeural`             |
| `iu-Latn-CA-SiqiniqNeural`            |
| `iu-Latn-CA-TaqqiqNeural`             |
| `ja-JP-NanamiNeural`                  |
| `ja-JP-KeitaNeural`                   |
| `ja-JP-AoiNeural`                     |
| `ja-JP-DaichiNeural`                  |
| `ja-JP-MayuNeural`                    |
| `ja-JP-NaokiNeural`                   |
| `ja-JP-ShioriNeural`                  |
| `jv-ID-SitiNeural`                    |
| `jv-ID-DimasNeural`                   |
| `ka-GE-EkaNeural`                     |
| `ka-GE-GiorgiNeural`                  |
| `kk-KZ-AigulNeural`                   |
| `kk-KZ-DauletNeural`                  |
| `km-KH-SreymomNeural`                 |
| `km-KH-PisethNeural`                  |
| `kn-IN-SapnaNeural`                   |
| `kn-IN-GaganNeural`                   |
| `ko-KR-SunHiNeural`                   |
| `ko-KR-InJoonNeural`                  |
| `ko-KR-HyunsuMultilingualNeural`      |
| `ko-KR-BongJinNeural`                 |
| `ko-KR-GookMinNeural`                 |
| `ko-KR-HyunsuNeural`                  |
| `ko-KR-JiMinNeural`                   |
| `ko-KR-SeoHyeonNeural`                |
| `ko-KR-SoonBokNeural`                 |
| `ko-KR-YuJinNeural`                   |
| `lo-LA-KeomanyNeural`                 |
| `lo-LA-ChanthavongNeural`             |
| `lt-LT-OnaNeural`                     |
| `lt-LT-LeonasNeural`                  |
| `lv-LV-EveritaNeural`                 |
| `lv-LV-NilsNeural`                    |
| `mk-MK-MarijaNeural`                  |
| `mk-MK-AleksandarNeural`              |
| `ml-IN-SobhanaNeural`                 |
| `ml-IN-MidhunNeural`                  |
| `mn-MN-YesuiNeural`                   |
| `mn-MN-BataaNeural`                   |
| `mr-IN-AarohiNeural`                  |
| `mr-IN-ManoharNeural`                 |
| `ms-MY-YasminNeural`                  |
| `ms-MY-OsmanNeural`                   |
| `mt-MT-GraceNeural`                   |
| `mt-MT-JosephNeural`                  |
| `my-MM-NilarNeural`                   |
| `my-MM-ThihaNeural`                   |
| `nb-NO-PernilleNeural`                |
| `nb-NO-FinnNeural`                    |
| `nb-NO-IselinNeural`                  |
| `ne-NP-HemkalaNeural`                 |
| `ne-NP-SagarNeural`                   |
| `nl-BE-DenaNeural`                    |
| `nl-BE-ArnaudNeural`                  |
| `nl-NL-FennaNeural`                   |
| `nl-NL-MaartenNeural`                 |
| `nl-NL-ColetteNeural`                 |
| `or-IN-SubhasiniNeural`               |
| `or-IN-SukantNeural`                  |
| `pa-IN-OjasNeural`                    |
| `pa-IN-VaaniNeural`                   |
| `pl-PL-AgnieszkaNeural`               |
| `pl-PL-MarekNeural`                   |
| `pl-PL-ZofiaNeural`                   |
| `ps-AF-LatifaNeural`                  |
| `ps-AF-GulNawazNeural`                |
| `pt-BR-FranciscaNeural`               |
| `pt-BR-AntonioNeural`                 |
| `pt-BR-MacerioMultilingualNeural`     |
| `pt-BR-ThalitaMultilingualNeural`     |
| `pt-BR-BrendaNeural`                  |
| `pt-BR-DonatoNeural`                  |
| `pt-BR-ElzaNeural`                    |
| `pt-BR-FabioNeural`                   |
| `pt-BR-GiovannaNeural`                |
| `pt-BR-HumbertoNeural`                |
| `pt-BR-JulioNeural`                   |
| `pt-BR-LeilaNeural`                   |
| `pt-BR-LeticiaNeural`                 |
| `pt-BR-ManuelaNeural`                 |
| `pt-BR-NicolauNeural`                 |
| `pt-BR-ThalitaNeural`                 |
| `pt-BR-ValerioNeural`                 |
| `pt-BR-YaraNeural`                    |
| `pt-PT-RaquelNeural`                  |
| `pt-PT-DuarteNeural`                  |
| `pt-PT-FernandaNeural`                |
| `ro-RO-AlinaNeural`                   |
| `ro-RO-EmilNeural`                    |
| `ru-RU-SvetlanaNeural`                |
| `ru-RU-DmitryNeural`                  |
| `ru-RU-DariyaNeural`                  |
| `si-LK-ThiliniNeural`                 |
| `si-LK-SameeraNeural`                 |
| `sk-SK-ViktoriaNeural`                |
| `sk-SK-LukasNeural`                   |
| `sl-SI-PetraNeural`                   |
| `sl-SI-RokNeural`                     |
| `so-SO-UbaxNeural`                    |
| `so-SO-MuuseNeural`                   |
| `sq-AL-AnilaNeural`                   |
| `sq-AL-IlirNeural`                    |
| `sr-Latn-RS-NicholasNeural`           |
| `sr-Latn-RS-SophieNeural`             |
| `sr-RS-SophieNeural`                  |
| `sr-RS-NicholasNeural`                |
| `su-ID-TutiNeural`                    |
| `su-ID-JajangNeural`                  |
| `sv-SE-SofieNeural`                   |
| `sv-SE-MattiasNeural`                 |
| `sv-SE-HilleviNeural`                 |
| `sw-KE-ZuriNeural`                    |
| `sw-KE-RafikiNeural`                  |
| `sw-TZ-RehemaNeural`                  |
| `sw-TZ-DaudiNeural`                   |
| `ta-IN-PallaviNeural`                 |
| `ta-IN-ValluvarNeural`                |
| `ta-LK-SaranyaNeural`                 |
| `ta-LK-KumarNeural`                   |
| `ta-MY-KaniNeural`                    |
| `ta-MY-SuryaNeural`                   |
| `ta-SG-VenbaNeural`                   |
| `ta-SG-AnbuNeural`                    |
| `te-IN-ShrutiNeural`                  |
| `te-IN-MohanNeural`                   |
| `th-TH-PremwadeeNeural`               |
| `th-TH-NiwatNeural`                   |
| `th-TH-AcharaNeural`                  |
| `tr-TR-EmelNeural`                    |
| `tr-TR-AhmetNeural`                   |
| `uk-UA-PolinaNeural`                  |
| `uk-UA-OstapNeural`                   |
| `ur-IN-GulNeural`                     |
| `ur-IN-SalmanNeural`                  |
| `ur-PK-UzmaNeural`                    |
| `ur-PK-AsadNeural`                    |
| `uz-UZ-MadinaNeural`                  |
| `uz-UZ-SardorNeural`                  |
| `vi-VN-HoaiMyNeural`                  |
| `vi-VN-NamMinhNeural`                 |
| `wuu-CN-XiaotongNeural`               |
| `wuu-CN-YunzheNeural`                 |
| `yue-CN-XiaoMinNeural`                |
| `yue-CN-YunSongNeural`                |
| `zh-CN-XiaoxiaoNeural`                |
| `zh-CN-YunxiNeural`                   |
| `zh-CN-YunjianNeural`                 |
| `zh-CN-XiaoyiNeural`                  |
| `zh-CN-YunyangNeural`                 |
| `zh-CN-XiaochenNeural`                |
| `zh-CN-XiaochenMultilingualNeural`    |
| `zh-CN-XiaohanNeural`                 |
| `zh-CN-XiaomengNeural`                |
| `zh-CN-XiaomoNeural`                  |
| `zh-CN-XiaoqiuNeural`                 |
| `zh-CN-XiaorouNeural`                 |
| `zh-CN-XiaoruiNeural`                 |
| `zh-CN-XiaoshuangNeural`              |
| `zh-CN-XiaoxiaoDialectsNeural`        |
| `zh-CN-XiaoxiaoMultilingualNeural`    |
| `zh-CN-XiaoyanNeural`                 |
| `zh-CN-XiaoyouNeural`                 |
| `zh-CN-XiaoyuMultilingualNeural`      |
| `zh-CN-XiaozhenNeural`                |
| `zh-CN-YunfengNeural`                 |
| `zh-CN-YunhaoNeural`                  |
| `zh-CN-YunjieNeural`                  |
| `zh-CN-YunxiaNeural`                  |
| `zh-CN-YunyeNeural`                   |
| `zh-CN-YunyiMultilingualNeural`       |
| `zh-CN-YunzeNeural`                   |
| `zh-CN-henan-YundengNeural`           |
| `zh-CN-liaoning-XiaobeiNeural`        |
| `zh-CN-shaanxi-XiaoniNeural`          |
| `zh-CN-shandong-YunxiangNeural`       |
| `zh-CN-sichuan-YunxiNeural`           |
| `zh-HK-HiuMaanNeural`                 |
| `zh-HK-WanLungNeural`                 |
| `zh-HK-HiuGaaiNeural`                 |
| `zh-TW-HsiaoChenNeural`               |
| `zh-TW-YunJheNeural`                  |
| `zh-TW-HsiaoYuNeural`                 |
| `zu-ZA-ThandoNeural`                  |
| `zu-ZA-ThembaNeural`                  |

# Cartesia

Cartesia offers a wide selection of fully multilingual voices with very low latency.

Consult [Cartesia's Text-to-Speech documentation](https://docs.cartesia.ai/build-with-cartesia/models/tts) for more information and audio samples for available voices. [Create a Cartesia Account](https://play.cartesia.ai) to browse and test voices in the Cartesia Playground.

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

Copy the voice ID from the below table:

| Voice name                       | Voice ID                                   |
| -------------------------------- | ------------------------------------------ |
| German Conversational Woman      | ```
3f4ade23-6eb4-4279-ab05-6a144947c4d5
``` |
| Nonfiction Man                   | ```
79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e
``` |
| Friendly Sidekick                | ```
e00d0e4c-a5c8-443f-a8a3-473eb9a62355
``` |
| French Conversational Lady       | ```
a249eaff-1e96-4d2c-b23b-12efa4f66f41
``` |
| French Narrator Lady             | ```
8832a0b5-47b2-4751-bb22-6a8e2149303d
``` |
| German Reporter Woman            | ```
119e03e4-0705-43c9-b3ac-a658ce2b6639
``` |
| Indian Lady                      | ```
3b554273-4299-48b9-9aaf-eefd438e3941
``` |
| British Reading Lady             | ```
71a7ad14-091c-4e8e-a314-022ece01c121
``` |
| British Narration Lady           | ```
4d2fd738-3b3d-4368-957a-bb4805275bd9
``` |
| Japanese Children Book           | ```
44863732-e415-4084-8ba1-deabe34ce3d2
``` |
| Japanese Woman Conversational    | ```
2b568345-1d48-4047-b25f-7baccf842eb0
``` |
| Japanese Male Conversational     | ```
e8a863c6-22c7-4671-86ca-91cacffc038d
``` |
| Reading Lady                     | ```
15a9cd88-84b0-4a8b-95f2-5d583b54c72e
``` |
| Newsman                          | ```
d46abd1d-2d02-43e8-819f-51fb652c1c61
``` |
| Child                            | ```
2ee87190-8f84-4925-97da-e52547f9462c
``` |
| Meditation Lady                  | ```
cd17ff2d-5ea4-4695-be8f-42193949b946
``` |
| Maria                            | ```
5345cf08-6f37-424d-a5d9-8ae1101b9377
``` |
| 1920's Radioman                  | ```
41534e16-2966-4c6b-9670-111411def906
``` |
| Newslady                         | ```
bf991597-6c13-47e4-8411-91ec2de5c466
``` |
| Calm Lady                        | ```
00a77add-48d5-4ef6-8157-71e5437b282d
``` |
| Helpful Woman                    | ```
156fb8d2-335b-4950-9cb3-a2d33befec77
``` |
| Mexican Woman                    | ```
5c5ad5e7-1020-476b-8b91-fdcbe9cc313c
``` |
| California Girl                  | ```
b7d50908-b17c-442d-ad8d-810c63997ed9
``` |
| Korean Narrator Woman            | ```
663afeec-d082-4ab5-827e-2e41bf73a25b
``` |
| Russian Calm Lady                | ```
779673f3-895f-4935-b6b5-b031dc78b319
``` |
| Russian Narrator Man 1           | ```
2b3bb17d-26b9-421f-b8ca-1dd92332279f
``` |
| Russian Narrator Man 2           | ```
da05e96d-ca10-4220-9042-d8acef654fa9
``` |
| Russian Narrator Woman           | ```
642014de-c0e3-4133-adc0-36b5309c23e6
``` |
| Hinglish Speaking Lady           | ```
95d51f79-c397-46f9-b49a-23763d3eaa2d
``` |
| Italian Narrator Woman           | ```
0e21713a-5e9a-428a-bed4-90d410b87f13
``` |
| Polish Narrator Woman            | ```
575a5d29-1fdc-4d4e-9afa-5a9a71759864
``` |
| Chinese Female Conversational    | ```
e90c6678-f0d3-4767-9883-5d0ecf5894a8
``` |
| Pilot over Intercom              | ```
36b42fcb-60c5-4bec-b077-cb1a00a92ec6
``` |
| Chinese Commercial Man           | ```
eda5bbff-1ff1-4886-8ef1-4e69a77640a0
``` |
| French Narrator Man              | ```
5c3c89e5-535f-43ef-b14d-f8ffe148c1f0
``` |
| Spanish Narrator Man             | ```
a67e0421-22e0-4d5b-b586-bd4a64aee41d
``` |
| Reading Man                      | ```
f146dcec-e481-45be-8ad2-96e1e40e7f32
``` |
| New York Man                     | ```
34575e71-908f-4ab6-ab54-b08c95d6597d
``` |
| Friendly French Man              | ```
ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3
``` |
| Barbershop Man                   | ```
a0e99841-438c-4a64-b679-ae501e7d6091
``` |
| Indian Man                       | ```
638efaaa-4d0c-442e-b701-3fae16aad012
``` |
| Australian Customer Support Man  | ```
41f3c367-e0a8-4a85-89e0-c27bae9c9b6d
``` |
| Friendly Australian Man          | ```
421b3369-f63f-4b03-8980-37a44df1d4e8
``` |
| Wise Man                         | ```
b043dea0-a007-4bbe-a708-769dc0d0c569
``` |
| Friendly Reading Man             | ```
69267136-1bdc-412f-ad78-0caad210fb40
``` |
| Customer Support Man             | ```
a167e0f3-df7e-4d52-a9c3-f949145efdab
``` |
| Dutch Confident Man              | ```
9e8db62d-056f-47f3-b3b6-1b05767f9176
``` |
| Dutch Man                        | ```
4aa74047-d005-4463-ba2e-a0d9b261fb87
``` |
| Hindi Reporter Man               | ```
bdab08ad-4137-4548-b9db-6142854c7525
``` |
| Italian Calm Man                 | ```
408daed0-c597-4c27-aae8-fa0497d644bf
``` |
| Italian Narrator Man             | ```
029c3c7a-b6d9-44f0-814b-200d849830ff
``` |
| Swedish Narrator Man             | ```
38a146c3-69d7-40ad-aada-76d5a2621758
``` |
| Polish Confident Man             | ```
3d335974-4c4a-400a-84dc-ebf4b73aada6
``` |
| Spanish-speaking Storyteller Man | ```
846fa30b-6e1a-49b9-b7df-6be47092a09a
``` |
| Kentucky Woman                   | ```
4f8651b0-bbbd-46ac-8b37-5168c5923303
``` |
| Chinese Commercial Woman         | ```
0b904166-a29f-4d2e-bb20-41ca302f98e9
``` |
| Middle Eastern Woman             | ```
daf747c6-6bc2-4083-bd59-aa94dce23f5d
``` |
| Hindi Narrator Woman             | ```
c1abd502-9231-4558-a054-10ac950c356d
``` |
| Sarah                            | ```
694f9389-aac1-45b6-b726-9d9369183238
``` |
| Sarah Curious                    | ```
794f9389-aac1-45b6-b726-9d9369183238
``` |
| Laidback Woman                   | ```
21b81c14-f85b-436d-aff5-43f2e788ecf8
``` |
| Reflective Woman                 | ```
a3520a8f-226a-428d-9fcd-b0a4711a6829
``` |
| Helpful French Lady              | ```
65b25c5d-ff07-4687-a04c-da2f43ef6fa9
``` |
| Pleasant Brazilian Lady          | ```
700d1ee3-a641-4018-ba6e-899dcadc9e2b
``` |
| Customer Support Lady            | ```
829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30
``` |
| British Lady                     | ```
79a125e8-cd45-4c13-8a67-188112f4dd22
``` |
| Wise Lady                        | ```
c8605446-247c-4d39-acd4-8f4c28aa363c
``` |
| Australian Narrator Lady         | ```
8985388c-1332-4ce7-8d55-789628aa3df4
``` |
| Indian Customer Support Lady     | ```
ff1bb1a9-c582-4570-9670-5f46169d0fc8
``` |
| Swedish Calm Lady                | ```
f852eb8d-a177-48cd-bf63-7e4dcab61a36
``` |
| Spanish Narrator Lady            | ```
2deb3edf-b9d8-4d06-8db9-5742fb8a3cb2
``` |
| Salesman                         | ```
820a3788-2b37-4d21-847a-b65d8a68c99a
``` |
| Yogaman                          | ```
f114a467-c40a-4db8-964d-aaba89cd08fa
``` |
| Movieman                         | ```
c45bc5ec-dc68-4feb-8829-6e6b2748095d
``` |
| Wizardman                        | ```
87748186-23bb-4158-a1eb-332911b0b708
``` |
| Australian Woman                 | ```
043cfc81-d69f-4bee-ae1e-7862cb358650
``` |
| Korean Calm Woman                | ```
29e5f8b4-b953-4160-848f-40fae182235b
``` |
| Friendly German Man              | ```
fb9fcab6-aba5-49ec-8d7e-3f1100296dde
``` |
| Announcer Man                    | ```
5619d38c-cf51-4d8e-9575-48f61a280413
``` |
| Wise Guide Man                   | ```
42b39f37-515f-4eee-8546-73e841679c1d
``` |
| Midwestern Man                   | ```
565510e8-6b45-45de-8758-13588fbaec73
``` |
| Kentucky Man                     | ```
726d5ae5-055f-4c3d-8355-d9677de68937
``` |
| Brazilian Young Man              | ```
5063f45b-d9e0-4095-b056-8f3ee055d411
``` |
| Chinese Call Center Man          | ```
3a63e2d1-1c1e-425d-8e79-5100bc910e90
``` |
| German Reporter Man              | ```
3f6e78a8-5283-42aa-b5e7-af82e8bb310c
``` |
| Confident British Man            | ```
63ff761f-c1e8-414b-b969-d1833d1c870c
``` |
| Southern Man                     | ```
98a34ef2-2140-4c28-9c71-663dc4dd7022
``` |
| Classy British Man               | ```
95856005-0332-41b0-935f-352e296aa0df
``` |
| Polite Man                       | ```
ee7ea9f8-c0c1-498c-9279-764d6b56d189
``` |
| Mexican Man                      | ```
15d0c2e2-8d29-44c3-be23-d585d5f154a1
``` |
| Korean Narrator Man              | ```
57dba6ff-fe3b-479d-836e-06f5a61cb5de
``` |
| Turkish Narrator Man             | ```
5a31e4fb-f823-4359-aa91-82c0ae9a991c
``` |
| Turkish Calm Man                 | ```
39f753ef-b0eb-41cd-aa53-2f3c284f948f
``` |
| Hindi Calm Man                   | ```
ac7ee4fa-25db-420d-bfff-f590d740aeb2
``` |
| Hindi Narrator Man               | ```
7f423809-0011-4658-ba48-a411f5e516ba
``` |
| Polish Narrator Man              | ```
4ef93bb3-682a-46e6-b881-8e157b6b4388
``` |
| Polish Young Man                 | ```
82a7fc13-2927-4e42-9b8a-bb1f9e506521
``` |
| Alabama Male                     | ```
40104aff-a015-4da1-9912-af950fbec99e
``` |
| Australian Male                  | ```
13524ffb-a918-499a-ae97-c98c7c4408c4
``` |
| Anime Girl                       | ```
1001d611-b1a8-46bd-a5ca-551b23505334
``` |
| Japanese Man Book                | ```
97e7d7a9-dfaa-4758-a936-f5f844ac34cc
``` |
| Sweet Lady                       | ```
e3827ec5-697a-4b7c-9704-1a23041bbc51
``` |
| Commercial Lady                  | ```
c2ac25f9-ecc4-4f56-9095-651354df60c0
``` |
| Teacher Lady                     | ```
573e3144-a684-4e72-ac2b-9b2063a50b53
``` |
| Princess                         | ```
8f091740-3df1-4795-8bd9-dc62d88e5131
``` |
| Commercial Man                   | ```
7360f116-6306-4e9a-b487-1235f35a0f21
``` |
| ASMR Lady                        | ```
03496517-369a-4db1-8236-3d3ae459ddf7
``` |
| Professional Woman               | ```
248be419-c632-4f23-adf1-5324ed7dbf1d
``` |
| Tutorial Man                     | ```
bd9120b6-7761-47a6-a446-77ca49132781
``` |
| Calm French Woman                | ```
a8a1eb38-5f15-4c1d-8722-7ac0f329727d
``` |
| New York Woman                   | ```
34bde396-9fde-4ebf-ad03-e3a1d1155205
``` |
| Spanish-speaking Lady            | ```
846d6cb0-2301-48b6-9683-48f5618ea2f6
``` |
| Midwestern Woman                 | ```
11af83e2-23eb-452f-956e-7fee218ccb5c
``` |
| Sportsman                        | ```
ed81fd13-2016-4a49-8fe3-c0d2761695fc
``` |
| Storyteller Lady                 | ```
996a8b96-4804-46f0-8e05-3fd4ef1a87cd
``` |
| Spanish-speaking Man             | ```
34dbb662-8e98-413c-a1ef-1a3407675fe7
``` |
| Doctor Mischief                  | ```
fb26447f-308b-471e-8b00-8e9f04284eb5
``` |
| Spanish-speaking Reporter Man    | ```
2695b6b5-5543-4be1-96d9-3967fb5e7fec
``` |
| Young Spanish-speaking Woman     | ```
db832ebd-3cb6-42e7-9d47-912b425adbaa
``` |
| The Merchant                     | ```
50d6beb4-80ea-4802-8387-6c948fe84208
``` |
| Stern French Man                 | ```
0418348a-0ca2-4e90-9986-800fb8b3bbc0
``` |
| Madame Mischief                  | ```
e13cae5c-ec59-4f71-b0a6-266df3c9bb8e
``` |
| German Storyteller Man           | ```
db229dfe-f5de-4be4-91fd-7b077c158578
``` |
| Female Nurse                     | ```
5c42302c-194b-4d0c-ba1a-8cb485c84ab9
``` |
| German Conversation Man          | ```
384b625b-da5d-49e8-a76d-a2855d4f31eb
``` |
| Friendly Brazilian Man           | ```
6a16c1f4-462b-44de-998d-ccdaa4125a0a
``` |
| German Woman                     | ```
b9de4a89-2257-424b-94c2-db18ba68c81a
``` |
| Southern Woman                   | ```
f9836c6e-a0bd-460e-9d3c-f7299fa60f94
``` |
| British Customer Support Lady    | ```
a01c369f-6d2d-4185-bc20-b32c225eab70
``` |
| Chinese Woman Narrator           | ```
d4d4b115-57a0-48ea-9a1a-9898966c2966
``` |

<br />

<br />

Prepend `cartesia.` and the string is ready for use. For example: `cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab`

***

## Examples[​](#examples "Direct link to Examples")

See how to use Cartesia voices on the SignalWire platform.

* SWML
* RELAY Realtime SDK
* Call Flow Builder
* CXML

Use the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method to set one or more voices for an [AI agent](/swml/methods/ai.md).

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: Have an open-ended conversation about flowers.
      languages:
        - name: English
          code: en-US
          voice: cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab
```

Alternatively, use the [**`say_voice`** parameter](/swml/methods/play.md#parameters) of the [**`play`**](/swml/methods/play.md) SWML method to select a voice for basic TTS.

```
version: 1.0.0
sections:
  main:
  - set:
      say_voice: "cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab"
  - play: "say:Greetings. This is the Customer Support Man voice from Cartesia's Sonic text-to-speech model."
```

```
// This example uses the Node.js SDK for SignalWire's RELAY Realtime API.
const playback = await call.playTTS({ 
    text: "Greetings. This is the Customer Support Man voice from Cartesia's Sonic text-to-speech model.",
    voice: "cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab",
});
await playback.ended();
```

OpenAI voices are not yet supported in Call Flow Builder.

```
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab">
    Greetings. This is the Customer Support Man voice from Cartesia's Sonic text-to-speech model.
</Say>
</Response>
```

# ElevenLabs

ElevenLabs voices offer expressive, human-like pronunciation and an extensive list of supported languages. SignalWire supports the following voices in the `Multilingual v2` model:

| Voices                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Languages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`rachel`**, **`clyde`**, **`domi`**, **`dave`**, **`fin`**, **`antoni`**, **`thomas`**, **`charlie`**, **`emily`**, **`elli`**, **`callum`**, **`patrick`**, **`harry`**, **`liam`**, **`dorothy`**, **`josh`**, **`arnold`**, **`charlotte`**, **`matilda`**, **`matthew`**, **`james`**, **`joseph`**, **`jeremy`**, **`michael`**, **`ethan`**, **`gigi`**, **`freya`**, **`grace`**, **`daniel`**, **`serena`**, **`adam`**, **`nicole`**, **`jessie`**, **`ryan`**, **`sam`**, **`glinda`**, **`giovanni`**, **`mimi`** | 🇺🇸 English (USA), 🇬🇧 English (UK), 🇦🇺 English (Australia), 🇨🇦 English (Canada), 🇯🇵 Japanese, 🇨🇳 Chinese, 🇩🇪 German, 🇮🇳 Hindi, 🇫🇷 French (France), 🇨🇦 French (Canada), 🇰🇷 Korean, 🇧🇷 Portuguese (Brazil), 🇵🇹 Portuguese (Portugal), 🇮🇹 Italian, 🇪🇸 Spanish (Spain), 🇲🇽 Spanish (Mexico), 🇮🇩 Indonesian, 🇳🇱 Dutch, 🇹🇷 Turkish, 🇵🇭 Filipino, 🇵🇱 Polish, 🇸🇪 Swedish, 🇧🇬 Bulgarian, 🇷🇴 Romanian, 🇸🇦 Arabic (Saudi Arabia), 🇦🇪 Arabic (UAE), 🇨🇿 Czech, 🇬🇷 Greek, 🇫🇮 Finnish, 🇭🇷 Croatian, 🇲🇾 Malay, 🇸🇰 Slovak, 🇩🇰 Danish, 🇮🇳 Tamil, 🇺🇦 Ukrainian, 🇷🇺 Russian |

## Languages[​](#languages "Direct link to Languages")

Multilingual v2 voices are designed to be interchangeably compatible with all supported languages. Rather than enforcing language selection with language `code`, this TTS model automatically uses the appropriate language of the input text.

Consult ElevenLabs' [supported languages resource](https://help.elevenlabs.io/hc/en-us/articles/13313366263441-What-languages-do-you-support) for an up-to-date list of supported languages.

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

Copy the voice ID from the list of supported ElevenLabs voices above. Prepend `elevenlabs.` and the string is ready for use. For example: `elevenlabs.sam`

***

## Examples[​](#examples "Direct link to Examples")

Learn how to use ElevenLabs voices on the SignalWire platform.

* SWML
* RELAY Realtime SDK
* Call Flow Builder
* cXML

Use the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method to set one or more voices for an [AI agent](/swml/methods/ai.md).

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: Have an open-ended conversation about flowers.
      languages:
        - name: English
          code: en-US
          voice: elevenlabs.rachel
```

Alternatively, use the [**`say_voice`** parameter](/swml/methods/play.md#parameters) of the [**`play`**](/swml/methods/play.md) SWML method to select a voice for basic TTS.

```
version: 1.0.0
sections:
  main:
  - set:
      say_voice: "elevenlabs.rachel"
  - play: "say:Greetings. This is the Rachel voice, speaking in English, from ElevenLabs' Multilingual v2 text-to-speech model."
```

```
// This example uses the Node.js SDK for SignalWire's RELAY Realtime API.
const playback = await call.playTTS({ 
    text: "Greetings. This is the Rachel voice, speaking in English, from ElevenLabs' Multilingual v2 text-to-speech model.",
    voice: "elevenlabs.rachel",
});
await playback.ended();
```

ElevenLabs voices are not yet supported in Call Flow Builder.

```
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="elevenlabs.rachel">
    Greetings. This is the Rachel voice, speaking in English, from ElevenLabs' Multilingual v2 text-to-speech model.
</Say>
</Response>
```

# Google Cloud

Google Cloud offers a number of robust text-to-speech [voice models](https://cloud.google.com/text-to-speech/docs/voice-types). SignalWire supports all Google Cloud voices in both General Availability and Preview [launch stages](https://cloud.google.com/products?hl=en#product-launch-stages), except for the Studio model.

* [Standard](https://cloud.google.com/text-to-speech/docs/voice-types#standard_voices) is a basic, reliable, and budget-friendly text-to-speech model. The Standard model is less natural-sounding than WaveNet and Neural2, but more cost-effective.
* [WaveNet](https://cloud.google.com/text-to-speech/docs/voice-types#wavenet_voices) is powered by deep learning technology and offers more natural and lifelike speech output.
* [Neural2](https://cloud.google.com/text-to-speech/docs/voice-types#neural2_voices) is based on the same technology used to create [Custom Voices](https://cloud.google.com/text-to-speech/custom-voice/docs) and prioritizes natural and human-like pronunciation and intonation.
* [Polyglot](https://cloud.google.com/text-to-speech/docs/polyglot?hl=en#overview) voices have variants in multiple languages. For example, at time of writing, the `polyglot-1` voice has variants for English (Australia), English (US), French, German, Spanish (Spain), and Spanish (US).

## Languages[​](#languages "Direct link to Languages")

Sample all available voices with [Google's supported voices and languages reference](https://cloud.google.com/text-to-speech/docs/voices). Copy the voice identifier string in whole from the **Voice name** column.

Unlike the other supported engines, Google Cloud voice identifier strings include both voice and language keys, following the pattern `<language>-<model>-<variant>`. For example:

* English (UK) WaveNet female voice: `en-GB-Wavenet-A`
* Spanish (Spain) Neural2 male voice: `es-ES-Neural2-B`
* Mandarin Chinese Standard female voice: `cmn-CN-Standard-D`

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

Copy the voice ID in whole from the **Voice name** column of Google's table of [supported voices](https://cloud.google.com/text-to-speech/docs/voices). Google Cloud voice IDs encode language and model information, so no modification is needed to make these selections. Prepend `gcloud.` and the string is ready for use. For example: `gcloud.en-GB-Wavenet-A`

<!-- -->

***

## Examples[​](#examples "Direct link to Examples")

Learn how to use Google Cloud voices on the SignalWire platform.

* SWML
* RELAY Realtime SDK
* Call Flow Builder
* cXML

Use the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method to set one or more voices for an [AI agent](/swml/methods/ai.md).

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: Have an open-ended conversation about flowers.
      languages:
        - name: English
          code: en-US
          voice: gcloud.en-US-Neural2-A
```

Alternatively, use the [**`say_voice`** parameter](/swml/methods/play.md#parameters) of the [**`play`**](/swml/methods/play.md) SWML method to select a voice for basic TTS.

```
version: 1.0.0
sections:
  main:
  - set:
      say_voice: "gcloud.en-US-Neural2-A"
  - play: "say:Greetings. This is the 2-A US English voice from Google Cloud's Neural2 text-to-speech model."
```

```
// This example uses the Node.js SDK for SignalWire's RELAY Realtime API.
const playback = await call.playTTS({ 
    text: "Greetings. This is the 2-A US English voice from Google Cloud's Neural2 text-to-speech model.",
    voice: "gcloud.en-US-Neural2-A",
});
await playback.ended();
```

![The Call Flow Builder interface. A voice is selected in the drop-down menu.](/assets/images/gcloud-cfb-voice-610f61f20766171c2f8d18152a805b6e.webp)

```
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="gcloud.en-US-Neural2-A">
    Greetings. This is the 2-A Neural2 English voice from Google Cloud.
</Say>
</Response>
```

# OpenAI

OpenAI offers versatile multilingual voices balancing low latency and good quality. While voices are optimized for English, they perform well across all [supported languages](https://platform.openai.com/docs/guides/text-to-speech/supported-languages).

Consult [OpenAI's Text-to-Speech documentation](https://platform.openai.com/docs/guides/text-to-speech/overview) for more information and audio samples for available voices.

## Voice IDs[​](#voice-ids "Direct link to Voice IDs")

Copy the voice ID from OpenAI's [Voice Options](https://platform.openai.com/docs/guides/text-to-speech/voice-options) reference.

Prepend `openai.` and the string is ready for use. For example: `openai.alloy`

***

## Examples[​](#examples "Direct link to Examples")

Learn how to use OpenAI voices on the SignalWire platform.

* SWML
* RELAY Realtime SDK
* Call Flow Builder
* cXML

Use the [**`languages`**](/swml/methods/ai/languages.md#use-voice-strings) SWML method to set one or more voices for an [AI agent](/swml/methods/ai.md).

```
version: 1.0.0
sections:
  main:
  - ai:
      prompt:
        text: Have an open-ended conversation about flowers.
      languages:
        - name: English
          code: en-US
          voice: openai.alloy
```

Alternatively, use the [**`say_voice`** parameter](/swml/methods/play.md#parameters) of the [**`play`**](/swml/methods/play.md) SWML method to select a voice for basic TTS.

```
version: 1.0.0
sections:
  main:
  - set:
      say_voice: "openai.alloy"
  - play: "say:Greetings. This is the Alloy voice from OpenAI's text-to-speech model."
```

```
// This example uses the Node.js SDK for SignalWire's RELAY Realtime API.
const playback = await call.playTTS({ 
    text: "Greetings. This is the Alloy voice from OpenAI's text-to-speech model.",
    voice: "openai.alloy",
});
await playback.ended();
```

OpenAI voices are not yet supported in Call Flow Builder.

```
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="openai.alloy">
    Greetings. This is the Alloy voice from OpenAI's text-to-speech model.
</Say>
</Response>
```

