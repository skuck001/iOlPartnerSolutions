import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { authenticateUser } from '../../shared/auth.middleware';
import { AISummaryService } from './ai-summary.service';
import { OpportunitiesService } from './opportunities.service';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

// Define the AI API keys as secrets
const googleAiApiKey = defineSecret('GOOGLE_AI_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Lazy initialization variables
let opportunitiesService: OpportunitiesService | null = null;
let aiSummaryService: AISummaryService | null = null;

function getOpportunitiesService(): OpportunitiesService {
  if (!opportunitiesService) {
    const db = getFirestore();
    opportunitiesService = new OpportunitiesService(db);
  }
  return opportunitiesService;
}

function getAISummaryService(): AISummaryService {
  if (!aiSummaryService) {
    aiSummaryService = new AISummaryService();
  }
  return aiSummaryService;
}

/**
 * Manual trigger for generating AI summary for a specific opportunity
 */
export const generateOpportunitySummaryManualV2 = onCall({
  region: 'us-central1',
  cors: ['http://localhost:5173', 'https://localhost:5173', 'http://127.0.0.1:5173', 'https://iol-partner-solutions.web.app', 'https://iol-partner-solutions.firebaseapp.com'],
  maxInstances: 10,
  memory: '256MiB',
  secrets: [googleAiApiKey, openaiApiKey],
}, async (request) => {
  const startTime = Date.now();
  console.log('🚀 AI Summary Function V2 Started');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📊 Request data:', JSON.stringify(request.data || {}, null, 2));
  console.log('🔐 Auth present:', !!request.auth);
  console.log('👤 User UID:', request.auth?.uid || 'NOT_PROVIDED');

  try {
    // Step 1: Authentication
    console.log('🔍 Step 1: Authenticating user...');
    const user = await authenticateUser(request.auth);
    console.log('✅ User authenticated:', user.uid);
    
    // Step 2: Input validation
    console.log('🔍 Step 2: Validating input...');
    const { opportunityId } = request.data;
    
    if (!opportunityId) {
      console.error('❌ Validation failed: Missing opportunityId');
      throw new HttpsError('invalid-argument', 'Opportunity ID is required');
    }
    
    if (typeof opportunityId !== 'string' || opportunityId.trim().length === 0) {
      console.error('❌ Validation failed: Invalid opportunityId format:', opportunityId);
      throw new HttpsError('invalid-argument', 'Invalid opportunity ID format');
    }
    
    console.log('✅ Input validated - opportunityId:', opportunityId);

    // Step 3: Initialize services
    console.log('🔍 Step 3: Initializing services...');
    const opportunitiesServiceInstance = getOpportunitiesService();
    const aiSummaryServiceInstance = getAISummaryService();
    console.log('✅ Services initialized');

    // Step 4: Fetch opportunity
    console.log('🔍 Step 4: Fetching opportunity from database...');
    const opportunity = await opportunitiesServiceInstance.getOpportunity(opportunityId);
    
    if (!opportunity) {
      console.error('❌ Opportunity not found in database:', opportunityId);
      throw new HttpsError('not-found', 'Opportunity not found');
    }
    
    console.log('✅ Opportunity fetched successfully:');
    console.log('  - Title:', opportunity.title);
    console.log('  - Stage:', opportunity.stage);
    console.log('  - Activities count:', opportunity.activities?.length || 0);
    console.log('  - Owner:', opportunity.ownerId);
    console.log('  - Last updated:', opportunity.updatedAt?.toDate().toISOString());

    // Step 5: Check permissions (user owns opportunity)
    console.log('🔍 Step 5: Checking permissions...');
    if (opportunity.ownerId !== user.uid) {
      console.error('❌ Permission denied - User:', user.uid, 'Opportunity owner:', opportunity.ownerId);
      throw new HttpsError('permission-denied', 'You do not have permission to generate summary for this opportunity');
    }
    console.log('✅ Permission granted');

    // Step 6: Generate AI summary
    console.log('🔍 Step 6: Generating AI summary...');
    const summaryStartTime = Date.now();
    const summary = await aiSummaryServiceInstance.generateExecutiveSummary(opportunity);
    const summaryDuration = Date.now() - summaryStartTime;
    
    console.log('✅ AI summary generated successfully:');
    console.log('  - Summary length:', summary.length, 'characters');
    console.log('  - Generation time:', summaryDuration, 'ms');
    console.log('  - Summary preview:', summary.substring(0, 100) + (summary.length > 100 ? '...' : ''));

    // Step 7: Update opportunity in database (without audit logging to avoid errors)
    console.log('🔍 Step 7: Updating opportunity with new summary...');
    const updateStartTime = Date.now();
    const generatedAt = Timestamp.now();
    
    await opportunitiesServiceInstance.updateOpportunity(opportunityId, {
      aiSummary: summary,
      aiSummaryGeneratedAt: generatedAt,
      aiSummaryManuallyRequested: true,
      updatedAt: generatedAt
    }, user.uid);
    
    const updateDuration = Date.now() - updateStartTime;
    console.log('✅ Opportunity updated successfully');
    console.log('  - Update time:', updateDuration, 'ms');

    // Step 8: Prepare response
    const totalDuration = Date.now() - startTime;
    const response = { 
      success: true, 
      summary: summary,
      generatedAt: generatedAt.toDate().toISOString(),
      metadata: {
        opportunityId,
        userId: user.uid,
        processingTimeMs: totalDuration,
        summaryGenerationTimeMs: summaryDuration,
        dbUpdateTimeMs: updateDuration
      }
    };

    console.log('🎉 AI Summary Function V2 Completed Successfully');
    console.log('⏱️ Total execution time:', totalDuration, 'ms');
    console.log('📤 Response size:', JSON.stringify(response).length, 'bytes');
    
    return response;
    
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error('❌ Error in generateOpportunitySummaryManualV2:');
    console.error('⏱️ Failed after:', totalDuration, 'ms');
    console.error('🔍 Error type:', error?.constructor?.name || 'Unknown');
    console.error('📝 Error message:', error?.message || 'No message');
    console.error('📚 Error code:', error?.code || 'No code');
    console.error('🔗 Stack trace:', error?.stack || 'No stack trace');
    
    // Log additional context for debugging
    console.error('🔧 Debug context:', {
      requestData: request.data,
      authPresent: !!request.auth,
      userUid: request.auth?.uid,
      timestamp: new Date().toISOString()
    });
    
    if (error instanceof HttpsError) {
      console.error('🚨 Re-throwing HttpsError:', error.code, error.message);
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI summary';
    console.error('🚨 Throwing new internal error:', errorMessage);
    throw new HttpsError('internal', errorMessage);
  }
});

/**
 * Simple test function to verify Firebase SDK connectivity
 */
export const testFirebaseConnection = onCall({
  region: 'us-central1',
  cors: ['http://localhost:5173', 'https://localhost:5173', 'http://127.0.0.1:5173', 'https://iol-partner-solutions.web.app', 'https://iol-partner-solutions.firebaseapp.com'],
  maxInstances: 10,
}, async (request) => {
  console.log('🧪 Test Function Started');
  console.log('🔐 Auth present:', !!request.auth);
  console.log('👤 User UID:', request.auth?.uid || 'NOT_PROVIDED');
  
  try {
    const user = await authenticateUser(request.auth);
    console.log('✅ Authentication successful:', user.uid);
    
    return {
      success: true,
      message: 'Firebase SDK connection and authentication working correctly',
      userId: user.uid,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('❌ Test function error:', error);
    throw error;
  }
}); 