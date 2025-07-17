import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { authenticateUser } from '../../shared/auth.middleware';
import { AISummaryService } from './ai-summary.service';
import { OpportunitiesService } from './opportunities.service';
import { getFirestore } from 'firebase-admin/firestore';

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
 * Scheduled function that runs every 12 hours to generate AI summaries
 */
/*
export const autoGenerateAISummaries = onSchedule({
  schedule: 'every 12 hours',
  timeZone: 'America/New_York', // Adjust to your timezone
  maxInstances: 1,
  memory: '256MiB', // Reduced memory usage
}, async () => {
  console.log('Starting automated AI summary generation...');
  
  try {
    // Get all opportunities
    const opportunitiesResponse = await opportunitiesService.getOpportunities({});
    
    // Filter opportunities that need AI summary updates
    const opportunitiesNeedingUpdate = opportunitiesResponse.opportunities.filter(opp => 
      AISummaryService.needsAISummaryUpdate(opp, 12)
    );

    console.log(`Found ${opportunitiesNeedingUpdate.length} opportunities needing AI summary updates`);

    let successCount = 0;
    let errorCount = 0;

    // Process opportunities in batches to avoid rate limits
    for (const opportunity of opportunitiesNeedingUpdate) {
      try {
        console.log(`Generating AI summary for opportunity: ${opportunity.title}`);
        
        const summary = await getAISummaryService().generateExecutiveSummary(opportunity);
        
        // Update opportunity with new summary
        await opportunitiesService.updateOpportunity(opportunity.id!, {
          aiSummary: summary,
          aiSummaryGeneratedAt: Timestamp.now(),
          aiSummaryManuallyRequested: false, // Reset manual flag
          updatedAt: Timestamp.now()
        }, 'system');

        successCount++;
        console.log(`✅ Generated summary for ${opportunity.title}: "${summary.substring(0, 50)}..."`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to generate summary for ${opportunity.title}:`, error);
        
        // Continue with other opportunities even if one fails
        continue;
      }
    }

    console.log(`Automated AI summary generation completed. Success: ${successCount}, Errors: ${errorCount}`);

    // Log to audit for monitoring
    await AuditService.log({
      userId: 'system',
      action: 'auto-generate',
      resourceType: 'ai-summary',
      resourceId: 'batch',
      data: { 
        processed: opportunitiesNeedingUpdate.length,
        successful: successCount,
        failed: errorCount
      }
    });

  } catch (error) {
    console.error('Error in automated AI summary generation:', error);
    throw error;
  }
});
*/

/**
 * Manual trigger for AI summary generation from frontend
 */
export const generateOpportunitySummaryManual = onCall({
  cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'],
  maxInstances: 10,
  memory: '256MiB', // Reduced memory usage
}, async (request) => {
  try {
    const user = await authenticateUser(request.auth);

    console.log('🚀 AI Summary Function Started - LAZY INIT VERSION');
    console.log('📊 Request data:', JSON.stringify(request.data || {}));
    console.log('🔐 Auth present:', !!request.auth);
    
    // Basic validation
    const { opportunityId } = request.data;
    
    if (!opportunityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID is required');
    }

    // Use lazy initialization
    const opportunitiesServiceInstance = getOpportunitiesService();
    const aiSummaryServiceInstance = getAISummaryService();

    const opportunity = await opportunitiesServiceInstance.getOpportunity(opportunityId);
    if (!opportunity) {
      throw new HttpsError('not-found', 'Opportunity not found');
    }

    const summary = await aiSummaryServiceInstance.generateExecutiveSummary(opportunity);

    await opportunitiesServiceInstance.updateOpportunity(opportunityId, {
      aiSummary: summary,
      aiSummaryGeneratedAt: Timestamp.now(),
      aiSummaryManuallyRequested: true,
      updatedAt: Timestamp.now()
    }, user.uid);

    console.log(`✅ LAZY: Generated summary for opportunity: ${opportunityId}`);

    // Return a mock response to test CORS and basic functionality
    return { 
      success: true, 
      summary: summary,
      generatedAt: Timestamp.now().toDate().toISOString(),
      note: "Lazy init version for testing"
    };
    
  } catch (error) {
    console.error('❌ Error in generateOpportunitySummaryManual (LAZY):', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI summary';
    throw new HttpsError('internal', errorMessage);
  }
}); 