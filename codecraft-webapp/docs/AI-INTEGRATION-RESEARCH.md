# AI-integratie onderzoek: alternatieven naast Claude Haiku

**Datum:** december 2025  
**Huidige situatie:** Claude (Haiku) wordt o.a. gebruikt in live chat (`/api/chat/ai`), Comcraft AI-assistant (`/api/ai-assistant`), en in de Discord-bot AI (naast Gemini en DeepSeek).

---

## 1. Huidige setup in jullie project

| Plek | Provider | Model | Features |
|------|----------|--------|----------|
| Live chat (website) | Alleen Anthropic | `CLAUDE_MODEL` / claude-haiku-4-5 | Web search tool |
| Comcraft AI (dashboard) | Alleen Anthropic | claude-3-5-haiku-20241022 | Geen tools in call |
| Discord-bot `/askai` | **Gemini (default)** of Claude of DeepSeek | Per provider | Tool use, web search per provider |

De **Discord-bot** heeft al meerdere providers: server-eigenaren kunnen in het dashboard **AI → Settings** kiezen voor **Gemini**, **Claude** of **DeepSeek**. De standaard is **Gemini** (`AI_PRIMARY_PROVIDER` / default_provider).

---

## 2. Vergelijking AI-API’s (2024–2025)

### 2.1 Prijzen (per miljoen tokens, indicatief)

| Provider | Model | Input | Output | Opmerking |
|----------|--------|--------|--------|------------|
| **Anthropic** | Haiku 4.5 | $1 | $5 | Snel, goedkoop; prompt caching nog goedkoper |
| **Anthropic** | Sonnet 4.5 | $3 | $15 | Beter redeneren/kwaliteit dan Haiku |
| **Anthropic** | Opus 4.6 | $5–10 | $25–37.50 | Topkwaliteit, duurder |
| **Google** | Gemini 2.5 Pro | $1.25–2.50 | $10–15 | Sterk, lange context, grounding |
| **Google** | Gemini 1.5 Pro/Flash | Lager | Lager | Goede prijs/kwaliteit |
| **OpenAI** | GPT-4o | ~$2.50 | ~$10 | Sterke tool use, 128K context |
| **DeepSeek** | V3 / Chat | Zeer laag | Zeer laag | Meest kostenefficiënt |
| **xAI** | Grok 3 | $3 | $15 | Alternatief, redelijke prijs |

### 2.2 Features die voor jullie relevant zijn

| Feature | Claude | Gemini | OpenAI GPT-4o | DeepSeek |
|---------|--------|--------|----------------|----------|
| **Tool / function calling** | ✅ | ✅ | ✅ (zeer sterk) | ✅ |
| **Web search / real-time info** | ✅ (web_search_20250305) | ✅ (grounding) | ✅ (afhankelijk van setup) | Beperkt |
| **Streaming** | ✅ | ✅ | ✅ | ✅ |
| **Lange context (100K+)** | 200K | 1M+ (Gemini 1.5) | 128K | Groot |
| **Vision (afbeeldingen)** | ✅ | ✅ | ✅ | ✅ |
| **Prompt caching** | ✅ (kostendaling) | N.v.t. / anders | Anders | N.v.t. |

---

## 3. Aanbevelingen

### Optie A: Binnen Anthropic blijven, model kiezen op use-case (minste code)

- **Live chat / eenvoudige vragen:** blijf bij **Claude Haiku** (bijv. `claude-3-5-haiku-latest` of Haiku 4.5). Goedkoop en snel; web search gebruik je al.
- **Waar kwaliteit belangrijker is** (bijv. Comcraft AI-assistant, complexe support): overweeg **Claude Sonnet** (bijv. `claude-3-5-sonnet-latest` of Sonnet 4.5) via een aparte env var (bijv. `CLAUDE_MODEL_PREMIUM`) en die alleen daar aanroepen.

**Voordeel:** geen nieuwe provider; alleen model + eventueel route-specifieke config.  
**Nadeel:** alles blijft bij één leverancier.

---

### Optie B: OpenAI (GPT-4o) toevoegen als extra provider

- **Waarom:** zeer sterke tool/function calling, 128K context, veel gebruik in productiesystemen.
- **Implementatie:** nieuwe provider in `modules/comcraft/ai/providers/openai.js` (zelfde interface als Claude/Gemini/DeepSeek), registreren in de registry, en in het dashboard **default_provider** uitbreiden met `openai` (of `gpt4o`).
- **Kosten:** hoger dan Haiku/DeepSeek, vergelijkbaar met Sonnet/Gemini Pro.

**Voordeel:** server-eigenaren kunnen kiezen voor GPT-4o als ze dat willen.  
**Nadeel:** extra code + tweede API-key (OpenAI).

---

### Optie C: Bestaande providers beter benutten (meest impact voor weinig werk)

- **Gemini** is al jullie **standaard** in de bot en ondersteunt o.a.:
  - Zeer lange context (1M+ tokens bij 1.5 Pro)
  - Google Search grounding (actuele info)
  - Goede prijs/kwaliteit
- Zorg dat overal waar “AI” wordt gebruikt (inclusief docs/UX) duidelijk is dat server-eigenaren **Gemini, Claude of DeepSeek** kunnen kiezen.
- Voor **live chat** en **ai-assistant** op de website: overweeg om daar ook **provider-keuze** of een fallback naar Gemini in te bouwen (bijv. als `ANTHROPIC_API_KEY` ontbreekt), zodat je niet hard op één leverancier zit.

**Voordeel:** meer mogelijkheden zonder nieuwe integraties; betere benutting van wat er al is.

---

### Optie D: Model-upgrade binnen Claude (snelle kwaliteitsverbetering)

- Huidige default in code: o.a. `claude-3-5-haiku-latest` of Haiku 4.5.
- Voor betere antwoorden op complexe vragen:
  - Stel `CLAUDE_MODEL` (of een aparte variabele) in op **Sonnet** voor de Comcraft AI-assistant en/of live chat, **of**
  - Gebruik **Haiku 4.5** (nieuwste Haiku) waar die nog niet staat; die heeft betere kwaliteit dan oudere Haiku’s.

**Prijzen (Anthropic, indicatief):**  
Haiku 4.5: $1/$5 per M tokens; Sonnet 4.5: $3/$15 per M tokens. Web search: extra $10 per 1K searches.

---

## 4. Concreet: “meer functies”

Als “meer functies” betekent: **betere antwoorden, actuelere info, meer controle**:

1. **Web search** – bij Claude al in gebruik in live chat (`web_search_20250305`). Zelfde tool ook gebruiken in de Comcraft AI-assistant waar relevant.
2. **Beter model** – Haiku → Sonnet voor belangrijke flows (zie Optie D).
3. **Provider-keuze** – in de Discord-bot al aanwezig (Gemini/Claude/DeepSeek). Op de website hetzelfde concept: meerdere providers of fallback (Optie C).
4. **OpenAI toevoegen** – als je expliciet GPT-4o en zijn tool-ecosysteem wilt aanbieden (Optie B).

---

## 5. Aanbevolen volgorde

1. **Korte termijn:**  
   - Claude-model opwaarden naar **Haiku 4.5** (of nieuwste Haiku) overal waar nu Haiku staat.  
   - Voor de **Comcraft AI-assistant** (complexe vragen): optioneel **Sonnet** via eigen env var.

2. **Middellange termijn:**  
   - Live chat en/of ai-assistant **niet** hard op alleen Anthropic laten leunen: fallback naar **Gemini** als tweede provider (zelfde “meer functies”: lange context, grounding).

3. **Optioneel:**  
   - **OpenAI GPT-4o** als vierde provider in de Discord-bot en in config/dashboard toevoegen voor wie dat wil.

Als je aangeeft welke optie je wilt (alleen upgrade model, of ook OpenAI, of ook Gemini in live chat), kan de volgende stap zijn: concreet welke bestanden en env vars je daarvoor moet aanpassen.

---

## 6. AI-analyse van afbeeldingen (image moderation)

**Use-case:** Als iemand een afbeelding post, wil je die door een AI laten analyseren en bij ongepaste inhoud het bericht verwijderen (en eventueel waarschuwen).

### Geschikte optie: OpenAI Moderation API (omni-moderation)

| Aspect | Details |
|--------|---------|
| **Model** | `omni-moderation-latest` |
| **Kostprijs** | **Gratis** – de Moderation endpoint is gratis voor OpenAI API-gebruikers en telt niet mee voor je maandelijkse usage limits. |
| **Input** | Tekst en/of afbeeldingen (URL of base64). Je kunt dus de Discord attachment-URL doorsturen. |
| **Categorieën (o.a.)** | `sexual`, `sexual/minors` (tekst), `violence`, `violence/graphic`, `self-harm`, `self-harm/intent`, `self-harm/instructions`, `harassment`, `hate`, `illicit`, etc. |
| **Output** | Per categorie: `flagged` (boolean) en `category_scores` (0–1). Je kiest zelf een drempel (bijv. verwijderen als `sexual` of `violence/graphic` > 0.8). |

**Implementatie-idee:** In `auto-mod.js` (of message-create): als `message.attachments.size > 0` en er zijn afbeeldingen, voor elke image-URL `POST https://api.openai.com/v1/moderations` aanroepen met `model: "omni-moderation-latest"` en `input: [{ type: "image_url", image_url: { url: attachment.url } }]`. Als `results[0].flagged === true` (of bepaalde categorieën boven drempel), dan `message.delete()` en eventueel waarschuwing. Vereist alleen een **OpenAI API key** (zelfde key als voor GPT); er worden geen extra kosten in rekening gebracht voor Moderation.

### Alternatief: Vision-LLM (Claude/Gemini) voor custom policy

Als je een **eigen** prompt wilt (“is deze afbeelding geschikt voor een familie-server?”) in plaats van vaste categorieën, kun je Claude of Gemini **vision** gebruiken: stuur de afbeelding mee in de chat-API en vraag een ja/nee of score. Dat kost wél tokens (bijv. Claude Haiku vision ~$1/$5 per M tokens; een paar afbeeldingen per dag blijft goedkoop). Voor standaard “ongepast ja/nee” is **OpenAI omni-moderation gratis** en eenvoudiger.
