import { Opportunity } from '../../types';
import { Timestamp } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { defineSecret } from 'firebase-functions/params';

// Define the AI API keys as secrets
const googleAiApiKey = defineSecret('GOOGLE_AI_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// AI Provider Configuration - Uncomment the one you want to use
const AI_PROVIDER = 'openai'; // 'google' or 'openai'
// const AI_PROVIDER = 'google'; // 'google' or 'openai'

export class AISummaryService {
  
  async generateExecutiveSummary(opportunity: Opportunity): Promise<string> {
    console.log('🧠 AISummaryService: Starting AI executive summary generation');
    console.log('🤖 Using AI Provider:', AI_PROVIDER.toUpperCase());
    console.log('📋 Opportunity details:', {
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      activitiesCount: opportunity.activities?.length || 0,
      estimatedValue: opportunity.estimatedDealValue
    });

    try {
      console.log(`🤖 Generating AI summary with ${AI_PROVIDER.toUpperCase()}...`);
      const summary = await this.generateAISummary(opportunity);
      console.log('✅ AI summary generated successfully');
      return summary;
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      throw new Error(`Failed to generate AI summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateAISummary(opportunity: Opportunity): Promise<string> {
    console.log('🔍 Analyzing opportunity data for AI generation...');
    
    // Format opportunity data for AI prompt
    const opportunityContext = this.buildOpportunityContext(opportunity);
    
    // Executive AI prompt with your exact instructions
    const aiPrompt = `Generate a concise, professional 2-sentence status update for executive leadership based on opportunity records in a CRM. The company is iOL, so there is no need to explain its services or value proposition. Use a clear, human tone—no fluff, no sales language, no unnecessary background. Only mention agreements if they have explicitly been made; otherwise, refer to them as discussions, proposals, or concepts. Focus strictly on what has already happened (e.g., meetings, discussions, milestones) and what the current standing is. Summarize the latest status and past activities accurately and succinctly.

OPPORTUNITY DATA:
${opportunityContext}`;

    console.log('🤖 AI Prompt prepared:', {
      promptLength: aiPrompt.length,
      contextLines: opportunityContext.split('\n').length
    });
    
    console.log('📋 FULL AI PROMPT - START');
    console.log('='.repeat(50));
    
    // Break prompt into chunks to avoid log truncation
    const promptChunks = aiPrompt.match(/.{1,800}/g) || [aiPrompt];
    promptChunks.forEach((chunk, index) => {
      console.log(`📋 PROMPT CHUNK ${index + 1}/${promptChunks.length}:`);
      console.log(chunk);
      console.log('---');
    });
    
    console.log('📋 FULL AI PROMPT - END');
    console.log('='.repeat(50));

    // Route to the appropriate AI provider
    if (AI_PROVIDER === 'openai') {
      return await this.generateOpenAISummary(aiPrompt);
    } else {
      return await this.generateGoogleAISummary(aiPrompt);
    }
  }

  private async generateOpenAISummary(prompt: string): Promise<string> {
    console.log('🚀 Calling OpenAI ChatGPT-4o...');
    
    // Check if API key is available
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.');
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // ChatGPT-4o model
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const aiSummary = completion.choices[0]?.message?.content?.trim();
      
      console.log('✅ OpenAI response received:', {
        length: aiSummary?.length || 0,
        sentences: aiSummary?.split('.').filter(s => s.trim()).length || 0
      });

      if (!aiSummary || aiSummary.length < 10) {
        throw new Error('OpenAI generated empty or invalid summary');
      }

      return aiSummary;
    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API failed: ${error instanceof Error ? error.message : 'Unknown API error'}`);
    }
  }

  private async generateGoogleAISummary(prompt: string): Promise<string> {
    console.log('🚀 Calling Google Gemini AI...');
    
    // Check if API key is available
    const apiKey = googleAiApiKey.value();
    if (!apiKey) {
      throw new Error('Google AI API key not configured. Please set the GOOGLE_AI_API_KEY environment variable.');
    }

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiSummary = response.text().trim();
      
      console.log('✅ Google AI response received:', {
        length: aiSummary.length,
        sentences: aiSummary.split('.').filter(s => s.trim()).length
      });

      if (!aiSummary || aiSummary.length < 10) {
        throw new Error('Google AI generated empty or invalid summary');
      }

      return aiSummary;
    } catch (error) {
      console.error('❌ Google AI API error:', error);
      throw new Error(`Google AI API failed: ${error instanceof Error ? error.message : 'Unknown API error'}`);
    }
  }

  private buildOpportunityContext(opportunity: Opportunity): string {
    const activities = opportunity.activities || [];
    
    // Safe timestamp conversion helper
    const getTimestampAsDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      
      // If it's a Firestore Timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      
      // If it's already a Date
      if (timestamp instanceof Date) {
        return timestamp;
      }
      
      // If it's a string or number, try to parse it
      if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
      }
      
      // If it has seconds/nanoseconds (Firestore Timestamp serialized format)
      if (timestamp._seconds !== undefined) {
        return new Date(timestamp._seconds * 1000);
      }
      
      // Handle nested seconds format from Firestore
      if (timestamp.seconds !== undefined) {
        return new Date(timestamp.seconds * 1000);
      }
      
      return null;
    };

    const recentActivities = activities.filter(activity => {
      const activityDate = getTimestampAsDate(activity.dateTime);
      if (!activityDate) return false;
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return activityDate > thirtyDaysAgo;
    });

    let context = `Title: ${opportunity.title}\n`;
    
    if (opportunity.estimatedDealValue) {
      context += `Estimated Value: $${opportunity.estimatedDealValue.toLocaleString()}\n`;
    }
    
    if (opportunity.expectedCloseDate) {
      const closeDate = getTimestampAsDate(opportunity.expectedCloseDate);
      if (closeDate) {
        context += `Expected Close: ${closeDate.toLocaleDateString()}\n`;
      }
    }

    // Include description or summary
    if (opportunity.summary) {
      context += `Summary: ${opportunity.summary}\n`;
    } else if ((opportunity as any).summary) {
      context += `Description: ${(opportunity as any).summary}\n`;
    }

    context += `\nRECENT ACTIVITIES (Last 30 days):\n`;
    
    if (recentActivities.length === 0) {
      context += `No recent activities recorded.\n`;
    } else {
      // Sort activities by date (most recent first)
      const sortedActivities = recentActivities
        .map(activity => ({
          ...activity,
          sortableDate: getTimestampAsDate(activity.dateTime)
        }))
        .filter(activity => activity.sortableDate !== null)
        .sort((a, b) => b.sortableDate!.getTime() - a.sortableDate!.getTime())
        .slice(0, 10); // Limit to most recent 10 activities

      sortedActivities.forEach(activity => {
        const date = activity.sortableDate!.toLocaleDateString();
        
        // Handle actual activity data structure
        const activityType = (activity as any).activityType || (activity as any).type || 'Activity';
        const subject = (activity as any).subject || (activity as any).description || 'No subject';
        const status = activity.status || 'Unknown';
        const notes = (activity as any).notes || '';
        
        // Include notes if they exist and are meaningful
        const description = notes && notes.trim() && notes.trim() !== '' 
          ? `${subject} - ${notes.trim()}` 
          : subject;
        
        context += `- ${date}: ${activityType} - ${description} (${status})\n`;
      });
    }

    return context;
  }





  /**
   * Check if opportunity needs AI summary update
   */
  static needsAISummaryUpdate(opportunity: Opportunity, hoursThreshold: number = 12): boolean {
    const now = Timestamp.now();
    const thresholdTime = Timestamp.fromMillis(now.toMillis() - (hoursThreshold * 60 * 60 * 1000));

    // Skip if manually requested (will be reset after next auto-run)
    if (opportunity.aiSummaryManuallyRequested) {
      return false;
    }

    // Check if there are new activities since last summary (simplified check)
    const lastSummaryTime = opportunity.aiSummaryGeneratedAt || Timestamp.fromMillis(0);
    const hasNewActivities = (opportunity.activities || []).some(activity => 
      activity.dateTime.toMillis() > lastSummaryTime.toMillis() &&
      activity.dateTime.toMillis() > thresholdTime.toMillis()
    );

    // Or if no summary exists and opportunity has recent activity
    const noRecentSummary = !opportunity.aiSummaryGeneratedAt || 
      opportunity.aiSummaryGeneratedAt.toMillis() < thresholdTime.toMillis();

    return hasNewActivities || (noRecentSummary && (opportunity.activities || []).length > 0);
  }
} 