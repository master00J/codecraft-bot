# 📦 Capsules Guide

Capsules zijn een geavanceerd berichtformaat systeem dat flexibeler is dan traditionele embeds. Ze laten je toe om:

- **Meerdere embeds** in één bericht te combineren
- **Images** op verschillende plekken toe te voegen
- **Buttons en select menus** toe te voegen
- **Betere organisatie** van informatie

## 🎯 Wat zijn Capsules?

Capsules zijn een wrapper rond Discord's embed en component systeem. Ze maken het makkelijker om complexe, mooie berichten te maken zonder steeds dezelfde code te herhalen.

## 📚 Basis Gebruik

### Eenvoudige Capsule

```javascript
const CapsuleBuilder = require('./modules/comcraft/messaging/capsule-builder');

const capsule = CapsuleBuilder.create()
  .addSection({
    title: '🎉 Welkom!',
    description: 'Dit is een voorbeeld capsule.',
    color: 0x5865F2,
  })
  .addButtons([
    { customId: 'button1', label: 'Klik Mij!', style: ButtonStyle.Primary },
    { customId: 'button2', label: 'Of Mij!', style: ButtonStyle.Secondary }
  ]);

// Versturen
await capsule.send(channel);
// Of met interaction
await capsule.send(interaction);
```

### Meerdere Secties

```javascript
const capsule = CapsuleBuilder.create()
  .addSection({
    title: '📢 Aankondiging',
    description: 'Belangrijke informatie hier!',
    color: 0xFF0000,
  })
  .addImage('https://example.com/image.png', {
    title: 'Afbeelding Titel',
    description: 'Beschrijving van de afbeelding',
  })
  .addSection({
    title: '📋 Details',
    description: 'Meer informatie...',
    color: 0x00FF00,
    fields: [
      { name: 'Field 1', value: 'Value 1', inline: true },
      { name: 'Field 2', value: 'Value 2', inline: true },
    ],
  })
  .addButtons([
    { customId: 'action1', label: 'Actie 1', emoji: '✅' },
    { customId: 'action2', label: 'Actie 2', emoji: '❌' },
  ]);

await capsule.send(channel);
```

## 🎨 Voorgebouwde Templates

### Announcement Capsule

```javascript
const capsule = CapsuleBuilder.announcement(
  'Nieuwe Feature!',
  'We hebben een nieuwe feature toegevoegd!',
  'https://example.com/image.png', // Optioneel
  [
    { customId: 'learn_more', label: 'Meer Info', style: ButtonStyle.Primary },
    { customId: 'dismiss', label: 'Sluiten', style: ButtonStyle.Secondary }
  ]
);

await capsule.send(channel);
```

### Showcase Capsule (Product/Service)

```javascript
const capsule = CapsuleBuilder.showcase(
  'Premium Membership',
  'Upgrade naar premium voor exclusieve features!',
  [
    '✅ Geen advertenties',
    '✅ Exclusieve content',
    '✅ Prioriteit support',
    '✅ Early access features',
  ],
  'https://example.com/premium.png',
  '💰 **Prijs:** €9.99/maand',
  [
    { customId: 'buy_premium', label: 'Koop Nu', style: ButtonStyle.Success, emoji: '💳' },
    { customId: 'learn_more', label: 'Meer Info', style: ButtonStyle.Secondary },
  ]
);

await capsule.send(channel);
```

### Leaderboard Capsule

```javascript
const capsule = CapsuleBuilder.leaderboard(
  'Top Players',
  [
    { name: 'Player1', value: '10,000 XP' },
    { name: 'Player2', value: '9,500 XP' },
    { name: 'Player3', value: '9,000 XP' },
  ],
  'https://example.com/leaderboard.png' // Optioneel
);

await capsule.send(channel);
```

### Form Capsule

```javascript
const capsule = CapsuleBuilder.form(
  'Registratie Formulier',
  [
    {
      title: 'Persoonlijke Informatie',
      description: 'Vul je naam en email in.',
    },
    {
      title: 'Voorkeuren',
      description: 'Kies je voorkeuren.',
    },
    {
      title: 'Bevestiging',
      description: 'Bevestig je registratie.',
    },
  ],
  [
    { customId: 'start_form', label: 'Start', style: ButtonStyle.Primary },
  ]
);

await capsule.send(channel);
```

## 🔧 Geavanceerd Gebruik

### Select Menu Toevoegen

```javascript
const capsule = CapsuleBuilder.create()
  .addSection({
    title: 'Kies een Optie',
    description: 'Selecteer hieronder:',
  })
  .addSelectMenu({
    customId: 'choose_option',
    placeholder: 'Kies een optie...',
    options: [
      { label: 'Optie 1', value: 'option1', description: 'Eerste optie' },
      { label: 'Optie 2', value: 'option2', description: 'Tweede optie' },
      { label: 'Optie 3', value: 'option3', description: 'Derde optie' },
    ],
  });

await capsule.send(channel);
```

### File Attachments

```javascript
const capsule = CapsuleBuilder.create()
  .addSection({
    title: 'Document',
    description: 'Bijgevoegd document:',
  })
  .addFile('./path/to/file.pdf', 'document.pdf');

await capsule.send(channel);
```

### Content + Embeds

```javascript
const capsule = CapsuleBuilder.create()
  .setContent('📢 **Belangrijke Aankondiging!**')
  .addSection({
    title: 'Details',
    description: 'Meer informatie hieronder.',
  });

await capsule.send(channel);
```

## ⚠️ Discord Limieten

- **Max 10 embeds** per bericht
- **Max 5 action rows** (buttons/select menus)
- **Max 25 buttons** per action row
- **Max 25 select menu options**

De CapsuleBuilder waarschuwt automatisch als je deze limieten overschrijdt.

## 💡 Use Cases

1. **Server Announcements** - Mooie aankondigingen met images en buttons
2. **Product Showcases** - Feature lists, pricing, images
3. **Leaderboards** - Rankings met visuals
4. **Forms** - Multi-step formulieren
5. **Help Menus** - Georganiseerde help secties
6. **Event Pages** - Event details met registratie buttons

## 🚀 Integratie in Bot

```javascript
// In je command handler
const CapsuleBuilder = require('./modules/comcraft/messaging/capsule-builder');

// Gebruik in een command
async function handleAnnounceCommand(interaction) {
  const capsule = CapsuleBuilder.announcement(
    'Nieuwe Update!',
    'We hebben nieuwe features toegevoegd!',
    null,
    [
      { customId: 'view_changelog', label: 'Changelog', style: ButtonStyle.Primary },
    ]
  );

  await capsule.send(interaction);
}
```

## 🎨 Custom Templates Maken

Je kunt je eigen templates maken door de `CapsuleBuilder` class uit te breiden:

```javascript
class MyCustomCapsule extends CapsuleBuilder {
  static myTemplate(title, data) {
    const capsule = new CapsuleBuilder();
    
    capsule.addSection({
      title: title,
      description: data.description,
      color: 0x5865F2,
    });
    
    // ... meer logica
    
    return capsule;
  }
}
```

## 📝 Best Practices

1. **Gebruik max 5-6 embeds** voor leesbaarheid
2. **Gebruik consistente kleuren** per type bericht
3. **Voeg timestamps toe** voor belangrijke berichten
4. **Test op mobiel** - embeds zien er anders uit op mobiel
5. **Gebruik thumbnails** voor kleine images, full images voor grote

## 🔄 Migratie van Oude Embeds

```javascript
// Oud (traditionele embed)
const embed = new EmbedBuilder()
  .setTitle('Titel')
  .setDescription('Beschrijving')
  .setColor(0x5865F2);

await channel.send({ embeds: [embed] });

// Nieuw (capsule)
const capsule = CapsuleBuilder.create()
  .addSection({
    title: 'Titel',
    description: 'Beschrijving',
    color: 0x5865F2,
  });

await capsule.send(channel);
```

---

**Capsules maken je berichten professioneler en flexibeler!** 🎉

