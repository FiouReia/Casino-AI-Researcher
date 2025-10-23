import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// ==================== SCHEMAS ====================

const casinoSchema = new mongoose.Schema({
  name: String,
  state: String,
  stateAbbreviation: String,
  website: String,
  licenseNumber: String,
  casinodb_id: Number, // From original API
  discovered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

const offerSchema = new mongoose.Schema({
  casinoId: mongoose.Schema.Types.ObjectId,
  casinoName: String,
  state: String,
  stateAbbreviation: String,
  offerName: String,
  offerType: String,
  expectedDeposit: Number,
  expectedBonus: Number,
  description: String,
  bonusAmount: Number,
  bonusType: String,
  terms: String,
  source: String, // 'internal-api' or 'ai-research'
  casinodb_id: Number, // From original API
  discoveredDate: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  notes: String,
});

const researchRunSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  currentState: String,
  currentCasino: String,
  offersProcessed: { type: Number, default: 0 },
  casinosProcessed: { type: Number, default: 0 },
  progressLog: [String],
  missingCasinos: [
    {
      state: String,
      casinos: [String],
    },
  ],
  offerComparisons: [
    {
      casinoName: String,
      state: String,
      currentOffers: [Object],
      discoveredOffers: [Object],
      newOffers: [Object],
    },
  ],
  summary: {
    totalMissingCasinos: Number,
    totalNewOffers: Number,
    statesProcessed: [String],
  },
});

const Casino = mongoose.model('Casino', casinoSchema);
const Offer = mongoose.model('Offer', offerSchema);
const ResearchRun = mongoose.model('ResearchRun', researchRunSchema);

// ==================== AI RESEARCH SERVICE ====================

async function callClaudeAPI(prompt) {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'user', content: prompt }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          //'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          //'X-Title': 'Casino AI Researcher',
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API error:', error.response?.data || error.message);
    throw error;
  }
}

async function discoverCasinosByState(state) {
  const prompt = `You are a research assistant. Please provide a JSON response ONLY, no other text.

Find all currently licensed and operational casinos in ${state} according to official state gaming commission sources. 
Return ONLY valid JSON in this exact format:
{
  "casinos": [
    {
      "name": "Casino Name",
      "website": "https://website.com",
      "licenseNumber": "LIC123",
      "city": "City Name"
    }
  ]
}

Include all major casinos from official ${state} gaming commission data.`;

  try {
    const response = await callClaudeAPI(prompt);
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.casinos || [];
    }
    return [];
  } catch (error) {
    console.error(`Error discovering casinos for ${state}:`, error);
    return [];
  }
}

async function researchCasinoOffers(casinoName, state) {
  const prompt = `You are a research assistant. Please provide a JSON response ONLY, no other text.

Research the current casino (NOT sports betting) promotional offers for ${casinoName} in ${state}.
Return ONLY valid JSON in this exact format:
{
  "offers": [
    {
      "offerName": "Full Offer Name/Title",
      "offerType": "welcome|deposit-match|lossback|free-spins|reload|loyalty",
      "expectedDeposit": 1000,
      "expectedBonus": 1000,
      "description": "Detailed description of the offer",
      "terms": "Wagering requirements and terms"
    }
  ]
}

Focus on casino bonuses, not sports betting. Include deposit requirements and bonus amounts.
If no offers found, return {"offers": []}.`;

  try {
    const response = await callClaudeAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.offers || [];
    }
    return [];
  } catch (error) {
    console.error(`Error researching offers for ${casinoName}:`, error);
    return [];
  }
}

// ==================== API ENDPOINTS ====================

// Fetch and store initial offers from the provided API
app.post('/api/research/init', async (req, res) => {
  try {
    const response = await axios.get('https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB');
    const apiData = response.data;

    console.log(`Fetched ${apiData.length} offers from API`);

    // Store offers and extract casinos
    const casinos = new Map();
    let offersImported = 0;

    for (const item of apiData) {
      // Store offer with proper field mapping
      await Offer.findOneAndUpdate(
        {
          casinoName: item.Name,
          stateAbbreviation: item.state.Abbreviation,
          offerName: item.Offer_Name,
        },
        {
          casinoName: item.Name,
          state: item.state.Name,
          stateAbbreviation: item.state.Abbreviation,
          offerName: item.Offer_Name,
          offerType: item.offer_type || 'unknown',
          expectedDeposit: item.Expected_Deposit || 0,
          expectedBonus: item.Expected_Bonus || 0,
          bonusAmount: item.Expected_Bonus || 0,
          bonusType: (item.offer_type || 'unknown').toLowerCase(),
          source: 'internal-api',
          casinodb_id: item.casinodb_id,
          verified: true,
          discoveredDate: new Date(),
        },
        { upsert: true, new: true }
      );
      offersImported++;

      // Track unique casinos
      const casinoKey = `${item.Name}-${item.state.Abbreviation}`;
      if (!casinos.has(casinoKey)) {
        casinos.set(casinoKey, {
          name: item.Name,
          state: item.state.Name,
          stateAbbreviation: item.state.Abbreviation,
          casinodb_id: item.casinodb_id,
        });
      }
    }

    // Store casinos
    let casinosImported = 0;
    for (const casino of casinos.values()) {
      await Casino.findOneAndUpdate(
        { name: casino.name, stateAbbreviation: casino.stateAbbreviation },
        { ...casino, discovered: false, lastUpdated: new Date() },
        { upsert: true, new: true }
      );
      casinosImported++;
    }

    res.json({ 
      success: true, 
      offersImported, 
      casinos: casinosImported,
      message: `Imported ${offersImported} offers from ${casinosImported} casinos`
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger a full research run
app.post('/api/research/run', async (req, res) => {
  const run = await ResearchRun.create({ status: 'in-progress' });

  // Run async - don't wait for completion
  performResearch(run._id).catch(console.error);

  res.json({ runId: run._id, status: 'in-progress' });
});

async function performResearch(runId) {
  const progressLog = [];
  const logProgress = async (message) => {
    console.log(message);
    progressLog.push(`[${new Date().toISOString()}] ${message}`);
    await ResearchRun.findByIdAndUpdate(runId, { 
      $push: { progressLog: `[${new Date().toISOString()}] ${message}` }
    });
  };

  try {
    const run = await ResearchRun.findById(runId);
    const states = {
      'NJ': 'New Jersey',
      'MI': 'Michigan',
      'PA': 'Pennsylvania',
      'WV': 'West Virginia'
    };
    
    const missingCasinos = [];
    const offerComparisons = [];
    let totalNewOffers = 0;
    let totalCasinosProcessed = 0;
    let totalOffersProcessed = 0;

    await logProgress('🚀 Research started for all states');

    for (const [abbrev, stateName] of Object.entries(states)) {
      await ResearchRun.findByIdAndUpdate(runId, { 
        currentState: stateName,
        currentCasino: null 
      });
      await logProgress(`\n📍 Researching ${stateName} (${abbrev})...`);

      // Discover casinos
      await logProgress(`  🔍 Discovering casinos in ${stateName}...`);
      const discoveredCasinos = await discoverCasinosByState(stateName);
      await logProgress(`  ✅ Found ${discoveredCasinos.length} casinos in official records`);
      
      const existingCasinos = await Casino.find({ stateAbbreviation: abbrev, discovered: false });
      const existingNames = new Set(existingCasinos.map(c => c.name.toLowerCase().trim()));

      const missing = [];

      // Store discovered casinos and find missing ones
      for (const casino of discoveredCasinos) {
        const normalizedName = casino.name.toLowerCase().trim();
        const existingCasino = await Casino.findOne({
          $or: [
            { name: new RegExp(`^${casino.name}$` , 'i'), stateAbbreviation: abbrev },
            { name: normalizedName, stateAbbreviation: abbrev }
          ]
        });

        if (!existingCasino) {
          missing.push(casino.name);
          await Casino.create({
            ...casino,
            state: stateName,
            stateAbbreviation: abbrev,
            discovered: true,
            createdAt: new Date(),
            lastUpdated: new Date(),
          });
          await logProgress(`  ✨ Discovered new casino: ${casino.name}`);
        }
      }

      if (missing.length > 0) {
        missingCasinos.push({ state: stateName, casinos: missing });
        await logProgress(`  📋 Missing casinos in ${stateName}: ${missing.length}`);
      } else {
        await logProgress(`  ✅ No missing casinos in ${stateName}`);
      }

      // Research offers for all casinos in this state
      const allCasinos = await Casino.find({ stateAbbreviation: abbrev });
      await logProgress(`  🔍 Researching offers for ${allCasinos.length} casinos in ${stateName}...`);

      for (const casino of allCasinos) {
        totalCasinosProcessed++;
        await ResearchRun.findByIdAndUpdate(runId, { 
          currentCasino: casino.name,
          casinosProcessed: totalCasinosProcessed
        });
        await logProgress(`    🎰 Processing: ${casino.name}...`);
        
        const discoveredOffers = await researchCasinoOffers(casino.name, stateName);
        await logProgress(`      Found ${discoveredOffers.length} offers`);
        
        const currentOffers = await Offer.find({ 
          casinoName: casino.name, 
          stateAbbreviation: abbrev, 
          source: 'internal-api' 
        });

        // Find new offers
        const newOffers = discoveredOffers.filter(dOffer => {
          const exists = currentOffers.some(cOffer => {
            const nameMatch = cOffer.offerName?.toLowerCase().includes(dOffer.offerName?.toLowerCase()) ||
                             dOffer.offerName?.toLowerCase().includes(cOffer.offerName?.toLowerCase());
            const typeMatch = cOffer.offerType?.toLowerCase() === dOffer.offerType?.toLowerCase();
            const amountMatch = Math.abs((cOffer.expectedBonus || 0) - (dOffer.expectedBonus || 0)) < 50;
            
            return nameMatch || (typeMatch && amountMatch);
          });
          return !exists;
        });

        if (newOffers.length > 0) {
          totalNewOffers += newOffers.length;
          totalOffersProcessed += newOffers.length;
          await logProgress(`    💰 Found ${newOffers.length} new offers for ${casino.name}`);

          // Store new offers
          for (const offer of newOffers) {
            await Offer.create({
              casinoId: casino._id,
              casinoName: casino.name,
              state: stateName,
              stateAbbreviation: abbrev,
              offerName: offer.offerName,
              offerType: offer.offerType,
              expectedDeposit: offer.expectedDeposit || 0,
              expectedBonus: offer.expectedBonus || 0,
              bonusAmount: offer.expectedBonus || 0,
              bonusType: offer.offerType?.toLowerCase() || 'unknown',
              description: offer.description,
              terms: offer.terms,
              source: 'ai-research',
              discoveredDate: new Date(),
            });
          }

          offerComparisons.push({
            casinoName: casino.name,
            state: stateName,
            currentOffers: currentOffers.map(o => ({ 
              name: o.offerName, 
              type: o.offerType,
              deposit: o.expectedDeposit,
              bonus: o.expectedBonus 
            })),
            discoveredOffers: discoveredOffers.map(o => ({ 
              name: o.offerName, 
              type: o.offerType,
              deposit: o.expectedDeposit,
              bonus: o.expectedBonus 
            })),
            newOffers: newOffers.map(o => ({ 
              name: o.offerName, 
              type: o.offerType,
              deposit: o.expectedDeposit,
              bonus: o.expectedBonus,
              description: o.description
            })),
          });
        }
        
        await ResearchRun.findByIdAndUpdate(runId, { 
          offersProcessed: totalOffersProcessed
        });
      }
      
      await logProgress(`  ✅ Completed ${stateName} - Processed ${allCasinos.length} casinos`);
    }

    // Update research run
    await logProgress('\n✅ Research completed successfully');
    await logProgress(`   Total missing casinos: ${missingCasinos.reduce((sum, s) => sum + s.casinos.length, 0)}`);
    await logProgress(`   Total new offers: ${totalNewOffers}`);
    
    await ResearchRun.findByIdAndUpdate(runId, {
      status: 'completed',
      completedAt: new Date(),
      currentState: null,
      currentCasino: null,
      missingCasinos,
      offerComparisons,
      summary: {
        totalMissingCasinos: missingCasinos.reduce((sum, s) => sum + s.casinos.length, 0),
        totalNewOffers,
        statesProcessed: Object.values(states),
      },
    });

  } catch (error) {
    console.error('❌ Research error:', error);
    await logProgress(`❌ Research failed: ${error.message}`);
    await ResearchRun.findByIdAndUpdate(runId, {
      status: 'failed',
      completedAt: new Date(),
      currentState: null,
      currentCasino: null,
    });
  }
}

// Get research runs
app.get('/api/research/runs', async (req, res) => {
  const runs = await ResearchRun.find().sort({ startedAt: -1 }).limit(20);
  res.json(runs);
});

// Get specific research run
app.get('/api/research/runs/:id', async (req, res) => {
  const run = await ResearchRun.findById(req.params.id);
  res.json(run);
});

// Get all casinos
app.get('/api/casinos', async (req, res) => {
  const { state } = req.query;
  const query = state ? { stateAbbreviation: state } : {};
  const casinos = await Casino.find(query).sort({ state: 1, name: 1 });
  res.json(casinos);
});

// Get all offers
app.get('/api/offers', async (req, res) => {
  const { state, casinoId } = req.query;
  const query = {};
  if (state) query.stateAbbreviation = state;
  if (casinoId) query.casinoId = casinoId;
  const offers = await Offer.find(query).sort({ discoveredDate: -1 });
  res.json(offers);
});

// Get dashboard summary
app.get('/api/dashboard/summary', async (req, res) => {
  const totalCasinos = await Casino.countDocuments();
  const discoveredCasinos = await Casino.countDocuments({ discovered: true });
  const totalOffers = await Offer.countDocuments();
  const aiResearchOffers = await Offer.countDocuments({ source: 'ai-research' });
  const latestRun = await ResearchRun.findOne().sort({ startedAt: -1 });

  res.json({
    totalCasinos,
    discoveredCasinos,
    totalOffers,
    aiResearchOffers,
    latestRun,
  });
});

// Delete a specific offer
app.delete('/api/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    res.json({ success: true, message: 'Offer deleted', offerId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze offers with AI
app.post('/api/offers/analyze', async (req, res) => {
  try {
    const { currentOffers, newOffers, casinoName } = req.body;

    const prompt = `You are a casino promotions analyst. Compare these offers and determine which new offers are genuinely superior.

Casino: ${casinoName}

Current Offers (What we already have):
${currentOffers.map((o, i) => `${i + 1}. ${o.name} - Type: ${o.type}, Deposit: ${o.deposit}, Bonus: ${o.bonus}`).join('\n')}

New Offers (Discovered by AI):
${newOffers.map((o, i) => `${i + 1}. ${o.name} - Type: ${o.type}, Deposit: ${o.deposit}, Bonus: ${o.bonus}${o.description ? ', Description: ' + o.description : ''}`).join('\n')}

Analyze each new offer and return ONLY valid JSON in this format:
{
  "analysis": [
    {
      "offerName": "New offer name",
      "isSuperior": true or false,
      "reasoning": "Brief explanation why it's superior or not",
      "recommendation": "add" or "skip"
    }
  ]
}

Consider:
- Bonus percentage (higher is better)
- Wagering requirements (lower is better)
- Deposit requirements vs bonus amount ratio
- Uniqueness compared to current offers
- Value proposition for players`;

    const response = await callClaudeAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json({ analysis: parsed.analysis || [] });
    } else {
      res.json({ analysis: [] });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard will be at http://localhost:5173`);
  console.log(`🔌 API endpoints at http://localhost:${PORT}/api`);
});