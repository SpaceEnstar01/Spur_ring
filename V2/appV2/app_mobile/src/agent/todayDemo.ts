// Presentation fixtures only. Never submit these to Agent execution or user memory.
export const todayDemo = {
  performance: {
    title: 'Travel Video Performance Analysis',
    description:
      "Your Paris travel series outperformed your channel average, with 'Paris Street Food' getting 62% more views and audience retention up 28%.",
    thumbnail: require('../assets/today/paris.jpg'),
    metrics: [
      { icon: 'play', value: '1.2M', label: 'Total Views', change: '62%' },
      {
        icon: 'users',
        value: '28%',
        label: 'Audience Retention',
        change: '28%',
      },
      { icon: 'like', value: '4.8%', label: 'Engagement Rate', change: '16%' },
    ],
    insights: [
      ['Video', 'Paris Street Food'],
      [
        'Performance comparison',
        'Views are 62% above the channel average. Audience retention is up 28%, and engagement is up 16%.',
      ],
      [
        'AI insight',
        'Lead with a memorable food discovery. Combine practical recommendations with the small personal moments that make your Paris series distinctive.',
      ],
      [
        'Next experiment',
        'Try a neighborhood food walk with a strong opening scene and a clear recommendation at the end.',
      ],
    ],
  },
  script: {
    title: 'Viral Video Script & Structure Analysis',
    description:
      'Based on analysis of 10 similar viral travel videos, here are key script structures and content frameworks you can apply to your next video.',
    thumbnail: require('../assets/today/santorini.jpg'),
    referenceTitle: 'Santorini Travel Guide 2024',
    metadata: '3.4M views · Travel / City Exploration',
    duration: '12:34',
    analysis: [
      [
        'Opening Hook',
        'A compelling visual or question in the first few seconds.',
      ],
      [
        'Story Structure',
        'Hook → Destination Introduction → Key Experiences → Personal Perspective → Closing.',
      ],
      ['Pacing', 'Frequent visual transitions and concise narration.'],
      [
        'Engagement Strategy',
        'Practical recommendations mixed with personal storytelling.',
      ],
      [
        'Reusable Framework',
        'Open with an unexpected discovery, introduce the destination, share three experiences, add your personal perspective, and close with one useful takeaway.',
      ],
    ],
    prompt:
      'Help me adapt this travel video framework for my next project: Hook → Destination Introduction → Key Experiences → Personal Perspective → Closing. Ask me about my destination and creative direction first.',
  },
  decision: {
    title: 'Contact Photographer Jack?',
    description:
      'Photographer Jack was unable to shoot last Friday. Your agent recommends sending an email to check when the shooting materials will be delivered.',
    contactName: 'Jack',
    contactEmail: 'jack8899@163.com',
    subject: 'Follow-up on Shooting Materials',
    body: "Hi Jack,\n\nHope you're doing well.\n\nI’m following up on the shooting materials from our last project. Could you share a quick status update and your expected delivery date? If some files are already ready, a preview link would be helpful while the remaining materials are being prepared.\n\nThanks, and looking forward to hearing from you.\n\nBest,\n[Your Name]",
  },
};
