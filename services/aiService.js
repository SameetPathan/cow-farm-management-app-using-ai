// Anthropic API Configuration
const ANTHROPIC_API_KEY = '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';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call Anthropic API directly
 */
async function callAnthropicAPI(messages, systemPrompt, maxTokens = 1000) {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: maxTokens,
        messages: messages,
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

/**
 * Call AI for cow registration suggestions
 */
export async function getCowRegistrationAI(cowData) {
  try {
    const systemPrompt = `You are an expert dairy farm consultant specializing in cow management. Provide helpful, accurate advice about cow breeds, registration, and initial health tips. Be concise and practical.`;

    const userPrompt = `A farmer is registering a new cow with the following details:
- Name: ${cowData.name || 'Not provided'}
- Breed: ${cowData.breed || 'Not specified'}
- Date of Birth: ${cowData.dob || 'Not provided'}

Provide:
1. Brief breed information and characteristics (if breed is specified)
2. Initial health tips for this cow
3. Recommended vaccinations schedule
4. Feeding recommendations based on age
5. Any special care considerations

Format your response in a clear, structured way with bullet points.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const suggestions = await callAnthropicAPI(messages, systemPrompt, 1000);

    return {
      success: true,
      suggestions: suggestions,
    };
  } catch (error) {
    console.error('Error getting cow registration AI:', error);
    throw error;
  }
}

/**
 * Call AI for cow info analysis
 */
export async function getCowInfoAI(cowData, currentData) {
  try {
    const systemPrompt = `You are a veterinary expert specializing in dairy cattle health and management. Analyze cow health data and provide actionable recommendations. Be professional, clear, and prioritize animal welfare.`;

    const userPrompt = `Analyze the health status of a cow with the following information:

Cow Details:
- ID: ${cowData.uniqueId}
- Name: ${cowData.name}
- Breed: ${cowData.breed}
- Date of Birth: ${cowData.dob}

Current Health Data:
- Weight: ${currentData.weight || 'Not recorded'} kg
- Height: ${currentData.height || 'Not recorded'} cm
- Temperature: ${currentData.temperature || 'Not recorded'} °C
- Milk Yield: ${currentData.milkYield || 'Not recorded'} L/day
- Food Intake: ${currentData.intakeFood || 'Not recorded'} kg/day
- Water Intake: ${currentData.intakeWater || 'Not recorded'} L/day
- Vaccinations: ${currentData.vaccinations || 'None recorded'}
- Illness History: ${currentData.illnesses || 'None recorded'}

Provide:
1. Health status assessment
2. Any concerns or anomalies detected
3. Recommendations for improvement
4. Preventive care suggestions
5. Next steps if any issues are identified

Be specific and actionable.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const analysis = await callAnthropicAPI(messages, systemPrompt, 1500);

    return {
      success: true,
      analysis: analysis,
    };
  } catch (error) {
    console.error('Error getting cow info AI:', error);
    throw error;
  }
}

/**
 * Call AI for daily reports analysis
 */
export async function getDailyReportsAI(cowData, reportData) {
  try {
    const systemPrompt = `You are a dairy farm health monitoring specialist. Analyze daily health reports, detect anomalies, and provide insights about cow health trends. Focus on early detection of issues and preventive care.`;

    const userPrompt = `Analyze a daily health report for a cow:

Cow: ${cowData.name} (ID: ${cowData.uniqueId})
Date: ${reportData.date}

Health Status: ${reportData.healthStatus}
Illness Type: ${reportData.illnessType || 'N/A'}
Symptoms: ${reportData.symptoms || 'None'}
Temperature: ${reportData.temperature || 'Not recorded'} °F
Appetite: ${reportData.appetite || 'Not recorded'}
Medication: ${reportData.medication || 'None'}
Veterinarian Visit: ${reportData.veterinarianVisit ? 'Yes' : 'No'}
Notes: ${reportData.notes || 'None'}

Provide:
1. Health assessment and any concerns
2. Comparison with normal values
3. Recommendations for care
4. Warning signs to watch for
5. Follow-up actions if needed

Be concise and prioritize urgent issues.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const analysis = await callAnthropicAPI(messages, systemPrompt, 1500);

    return {
      success: true,
      analysis: analysis,
      recommendations: analysis,
    };
  } catch (error) {
    console.error('Error getting daily reports AI:', error);
    throw error;
  }
}

/**
 * Call AI for milk production analysis
 */
export async function getMilkProductionAI(cowData, milkData) {
  try {
    const systemPrompt = `You are a dairy production expert. Analyze milk production data, predict trends, assess quality, and provide recommendations to optimize milk yield and quality.`;

    const morning = milkData.morning || {};
    const evening = milkData.evening || {};
    const total = (parseFloat(morning.milkQuantity || 0) + parseFloat(evening.milkQuantity || 0)).toFixed(1);

    const userPrompt = `Analyze milk production data for a cow:

Cow: ${cowData.name} (ID: ${cowData.uniqueId})
Date: ${milkData.date}

Morning Session:
- Quantity: ${morning.milkQuantity || '0'} liters
- Quality: ${morning.milkQuality || 'Not recorded'}
- Temperature: ${morning.temperature || 'Not recorded'} °C

Evening Session:
- Quantity: ${evening.milkQuantity || '0'} liters
- Quality: ${evening.milkQuality || 'Not recorded'}
- Temperature: ${evening.temperature || 'Not recorded'} °C

Daily Total: ${total} liters

Provide:
1. Production analysis (is this normal for the breed/age?)
2. Quality assessment
3. Trends and predictions
4. Recommendations to improve yield/quality
5. Any concerns or anomalies

Be practical and data-driven.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const analysis = await callAnthropicAPI(messages, systemPrompt, 1500);

    return {
      success: true,
      analysis: analysis,
      predictions: analysis,
    };
  } catch (error) {
    console.error('Error getting milk production AI:', error);
    throw error;
  }
}

/**
 * Call AI for expenses analysis
 */
export async function getExpensesAI(expenseData, period = 'daily') {
  try {
    const systemPrompt = `You are a farm financial advisor specializing in dairy operations. Analyze expenses, identify cost-saving opportunities, and provide budget optimization recommendations.`;

    const userPrompt = `Analyze farm expenses for ${period}:

Date: ${expenseData.date}
Food/Feed Costs: ₹${expenseData.feed || 0}
Doctor/Veterinary Fees: ₹${expenseData.doctor || 0}
Other Expenses: ₹${expenseData.other || 0}
Total: ₹${(parseFloat(expenseData.feed || 0) + parseFloat(expenseData.doctor || 0) + parseFloat(expenseData.other || 0)).toFixed(2)}
Notes: ${expenseData.notes || 'None'}

Provide:
1. Cost analysis and breakdown
2. Comparison with typical dairy farm expenses
3. Cost-saving opportunities
4. Budget optimization suggestions
5. Recommendations for expense management

Focus on practical, actionable advice.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const analysis = await callAnthropicAPI(messages, systemPrompt, 1500);

    return {
      success: true,
      analysis: analysis,
      suggestions: analysis,
    };
  } catch (error) {
    console.error('Error getting expenses AI:', error);
    throw error;
  }
}

/**
 * Call AI for comprehensive reports analysis
 */
export async function getReportsAI(reportData) {
  try {
    const systemPrompt = `You are a dairy farm analytics expert. Analyze comprehensive farm data, identify trends, calculate profit/loss, and provide strategic insights for farm management.`;

    const userPrompt = `Analyze comprehensive farm data for a ${reportData.period || '30-day'} period:

Total Milk Production: ${reportData.totalMilkProduction || 0} liters
Total Expenses: ₹${reportData.totalExpenses || 0}
Profit/Loss: ₹${reportData.profitLoss || 0}
Number of Cows: ${reportData.totalCows || 0}
Healthy Cows: ${reportData.healthyCows || 0}
Sick Cows: ${reportData.sickCows || 0}

Additional Context:
${reportData.additionalData || 'None'}

Provide:
1. Overall farm performance assessment
2. Profitability analysis
3. Key trends and patterns
4. Strengths and areas for improvement
5. Strategic recommendations
6. Predictions for next period
7. Action items to optimize operations

Be comprehensive but clear.`;

    const messages = [{ role: 'user', content: userPrompt }];
    const analysis = await callAnthropicAPI(messages, systemPrompt, 2000);

    return {
      success: true,
      analysis: analysis,
      insights: analysis,
    };
  } catch (error) {
    console.error('Error getting reports AI:', error);
    throw error;
  }
}

