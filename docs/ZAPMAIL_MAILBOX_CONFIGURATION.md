# ZapMail Mailbox Configuration

**Date Created**: 2025-10-08  
**Total Mailboxes**: 30  
**Total Domains**: 15  
**Configuration**: 2 mailboxes per domain

---

## 📋 Active Personas

### 6 Individual Personas:
1. **Carlos Rodriguez** (Male, Latino/Hispanic)
2. **Maria Rodriguez** (Female, Latino/Hispanic)
3. **Rahul Patel** (Male, South Asian/Indian)
4. **Priya Patel** (Female, South Asian/Indian)
5. **Marcus Washington** (Male, African American)
6. **LaToYa Washington** (Female, African American)

**Distribution**: Each individual persona has 5 mailboxes across different domains

---

## 📧 Complete Mailbox Mapping

### Domain 1: askequityconnect.com
- carlos@askequityconnect.com
- maria@askequityconnect.com

### Domain 2: equityconnectadvisor.com
- rahul@equityconnectadvisor.com
- priya@equityconnectadvisor.com

### Domain 3: equityconnectcenter.com
- marcus@equityconnectcenter.com
- latoya@equityconnectcenter.com

### Domain 4: equityconnecthelp.com
- carlos@equityconnecthelp.com
- rahul@equityconnecthelp.com

### Domain 5: equityconnecthome.com
- maria@equityconnecthome.com
- priya@equityconnecthome.com

### Domain 6: equityconnecthq.com
- marcus@equityconnecthq.com
- carlos@equityconnecthq.com

### Domain 7: equityconnectinfo.com
- latoya@equityconnectinfo.com
- maria@equityconnectinfo.com

### Domain 8: equityconnectlending.com
- rahul@equityconnectlending.com
- marcus@equityconnectlending.com

### Domain 9: equityconnectnow.com
- priya@equityconnectnow.com
- latoya@equityconnectnow.com

### Domain 10: equityconnectpro.com
- carlos@equityconnectpro.com
- priya@equityconnectpro.com

### Domain 11: equityconnectreverse.com
- maria@equityconnectreverse.com
- marcus@equityconnectreverse.com

### Domain 12: equityconnectsolutions.com
- rahul@equityconnectsolutions.com
- latoya@equityconnectsolutions.com

### Domain 13: getequityconnect.com
- carlos@getequityconnect.com
- latoya@getequityconnect.com

### Domain 14: goequityconnect.com
- maria@goequityconnect.com
- rahul@goequityconnect.com

### Domain 15: yourequityconnect.com
- priya@yourequityconnect.com
- marcus@yourequityconnect.com

---

## 📊 Persona Distribution Summary

### Carlos Rodriguez (5 mailboxes)
1. carlos@askequityconnect.com
2. carlos@equityconnecthelp.com
3. carlos@equityconnecthq.com
4. carlos@equityconnectpro.com
5. carlos@getequityconnect.com

### Maria Rodriguez (5 mailboxes)
1. maria@askequityconnect.com
2. maria@equityconnecthome.com
3. maria@equityconnectinfo.com
4. maria@equityconnectreverse.com
5. maria@goequityconnect.com

### Rahul Patel (5 mailboxes)
1. rahul@equityconnectadvisor.com
2. rahul@equityconnecthelp.com
3. rahul@equityconnectlending.com
4. rahul@equityconnectsolutions.com
5. rahul@goequityconnect.com

### Priya Patel (5 mailboxes)
1. priya@equityconnectadvisor.com
2. priya@equityconnecthome.com
3. priya@equityconnectnow.com
4. priya@equityconnectpro.com
5. priya@yourequityconnect.com

### Marcus Washington (5 mailboxes)
1. marcus@equityconnectcenter.com
2. marcus@equityconnecthq.com
3. marcus@equityconnectlending.com
4. marcus@equityconnectreverse.com
5. marcus@yourequityconnect.com

### LaToYa Washington (5 mailboxes)
1. latoya@equityconnectcenter.com
2. latoya@equityconnectinfo.com
3. latoya@equityconnectnow.com
4. latoya@equityconnectsolutions.com
5. latoya@getequityconnect.com

---

## 🎯 Campaign Strategy

### Warmup Plan
- **Week 1-2**: 5-10 emails per day per mailbox
- **Week 3-4**: 10-20 emails per day per mailbox
- **Week 5+**: 20-30 emails per day per mailbox (full capacity)

### Cultural Targeting
- **Carlos/Maria**: Target Latino/Hispanic neighborhoods and leads
- **Rahul/Priya**: Target South Asian neighborhoods and leads
- **Marcus/LaToYa**: Target African American neighborhoods and leads

### Domain Rotation
- Rotate sending domains to maintain deliverability
- Use different domains for different campaign types
- Monitor domain reputation separately

---

## 📝 Integration Points

### Instantly.ai Campaigns
- Import mailboxes to Instantly
- Configure sending schedules per persona
- Set up persona-specific email sequences

### n8n Workflows
- Map lead persona assignment to correct mailbox
- Auto-select appropriate mailbox based on `assigned_persona` field in Supabase
- Round-robin within persona's 5 mailboxes for load balancing

### Supabase Database
- `leads.assigned_persona` field maps to these mailboxes
- Supported values: 'carlos_maria_rodriguez', 'priya_rahul_patel', 'marcus_latoya_washington'

---

## ⚠️ Important Notes

1. **Gender Matching**: System should match lead gender to persona gender when possible
2. **Load Balancing**: Distribute sends evenly across each persona's 5 mailboxes
3. **Domain Health**: Monitor each domain separately for deliverability issues
4. **Warmup Required**: All 30 mailboxes need proper warmup before full campaigns
5. **Cultural Authenticity**: Only assign personas that match lead demographics

---

## 🔗 Related Files
- `/prompts/persona-assignment-prompts.json` - Persona definitions
- `/config/api-configurations.json` - Voice profiles and configurations
- `/equity-connect-v2/SETUP_COMPLETE.md` - Database persona records

---

**Status**: ✅ Active and configured in ZapMail (2025-10-08)

