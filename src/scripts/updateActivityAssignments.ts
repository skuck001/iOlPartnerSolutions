import { getDocuments, updateDocument } from '../lib/firestore';
import type { Opportunity } from '../types';

// Function to update all activity assignments to a specific user
export const updateAllActivityAssignments = async (userId: string) => {
  console.log(`=== BULK ACTIVITY ASSIGNMENT UPDATE ===`);
  console.log(`Target User ID: ${userId}`);
  
  const results = {
    opportunitiesProcessed: 0,
    activitiesUpdated: 0,
    errors: [] as string[]
  };

  try {
    // Get all opportunities
    console.log('📁 Fetching all opportunities...');
    const opportunities = await getDocuments('opportunities') as Opportunity[];
    console.log(`Found ${opportunities.length} opportunities to process`);

    for (const opportunity of opportunities) {
      try {
        if (!opportunity.activities || opportunity.activities.length === 0) {
          console.log(`⏭️  Skipping ${opportunity.title} - no activities`);
          continue;
        }

        // Check if any activities need updating
        const activitiesNeedingUpdate = opportunity.activities.filter(
          activity => activity.assignedTo === 'current-user'
        );

        if (activitiesNeedingUpdate.length === 0) {
          console.log(`⏭️  Skipping ${opportunity.title} - no activities with 'current-user'`);
          continue;
        }

        console.log(`🔄 Processing ${opportunity.title} - ${activitiesNeedingUpdate.length} activities to update`);

        // Update activities
        const updatedActivities = opportunity.activities.map(activity => {
          if (activity.assignedTo === 'current-user') {
            return {
              ...activity,
              assignedTo: userId,
              updatedAt: new Date(),
              updatedBy: userId
            };
          }
          return activity;
        });

        // Update the opportunity document
        await updateDocument('opportunities', opportunity.id, {
          activities: updatedActivities,
          updatedAt: new Date()
        });

        results.opportunitiesProcessed++;
        results.activitiesUpdated += activitiesNeedingUpdate.length;

        console.log(`✅ Updated ${opportunity.title} - ${activitiesNeedingUpdate.length} activities assigned`);

      } catch (error) {
        const errorMsg = `Error processing opportunity ${opportunity.id}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Summary
    console.log('\n🎉 BULK ACTIVITY ASSIGNMENT UPDATE COMPLETE!');
    console.log('Summary:');
    console.log(`- Opportunities processed: ${results.opportunitiesProcessed}`);
    console.log(`- Activities updated: ${results.activitiesUpdated}`);
    console.log(`- Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('Error details:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    return results;

  } catch (error) {
    console.error('❌ Fatal error during bulk update:', error);
    throw error;
  }
};

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).updateAllActivityAssignments = updateAllActivityAssignments;
}

// Default export for easy importing
export default updateAllActivityAssignments; 