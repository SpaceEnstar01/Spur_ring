export type ConversationExampleData = {
  id: string;
  format:
    | 'compare'
    | 'conflict'
    | 'change'
    | 'missing'
    | 'checklist'
    | 'writing'
    | 'recap'
    | 'waiting';
  title: string;
  context: string;
  options: { label: string; response: string }[];
  lines?: string[];
};
export const conversationExamples: ConversationExampleData[] = [
  {
    id: 'direction',
    format: 'compare',
    title: 'Which story would you rather tell?',
    context: 'Two ways to approach your AI glasses video.',
    lines: [
      'A · A day in real life — more personal, requires a full day of filming.',
      'B · Three practical tests — focused, can be filmed in half a day.',
    ],
    options: [
      {
        label: 'A day in real life',
        response:
          'Lead with a morning-to-evening story. Capture what the glasses actually help with, and the moments when you reach for your phone instead.',
      },
      {
        label: 'Three practical tests',
        response:
          'Test hands-free capture, navigation and voice notes. Use the same task on your phone as a fair comparison.',
      },
      {
        label: 'Combine both',
        response:
          'Follow one day, with three short test chapters. End with who would benefit, and who should wait.',
      },
    ],
  },
  {
    id: 'schedule',
    format: 'conflict',
    title: 'Two plans need the same afternoon.',
    context:
      'A shoot and a brand call overlap in this scheduling scenario. Which would you move?',
    options: [
      {
        label: 'Move the shoot',
        response:
          'Proposed change: film in the morning. Check the location, daylight and crew availability before confirming. No calendar has been changed.',
      },
      {
        label: 'Reschedule the call',
        response:
          'Suggested message: “Could we move our call to the following morning? I have a shoot that afternoon.” Review the timing before sending.',
      },
      {
        label: 'I’ll arrange it',
        response: 'Leave both plans unchanged and handle the timing yourself.',
      },
    ],
  },
  {
    id: 'delivery-change',
    format: 'change',
    title: 'The delivery date has changed.',
    context:
      'In this collaboration scenario, Jack offers a Friday preview and the full materials on Sunday.',
    lines: [
      'Previously · All materials on Friday',
      'Updated · Preview Friday → Full delivery Sunday',
      'Impact · A Saturday release would need a different plan.',
    ],
    options: [
      {
        label: 'Adjust the release',
        response:
          'Prepare a Sunday edit and Monday release as a proposal. Confirm editing capacity before changing the schedule.',
      },
      {
        label: 'Discuss with Jack',
        response:
          'Suggested question: “Could you send the priority shots on Friday so I can start editing?” Nothing has been sent.',
      },
    ],
  },
  {
    id: 'missing-data',
    format: 'missing',
    title: 'Let’s separate evidence from guesses.',
    context:
      'Without account analytics, a higher view count alone cannot tell us why a video worked.',
    options: [
      {
        label: 'What data helps?',
        response:
          'Bring the same reporting period for both videos: impressions, click-through rate, average view duration, retention curve and traffic sources. A screenshot is enough to begin a review.',
      },
      {
        label: 'Analyze the structure first',
        response:
          'Start with the opening promise, when the first useful payoff arrives, pacing between scenes and whether the ending answers the opening question.',
      },
    ],
  },
  {
    id: 'shoot-checklist',
    format: 'checklist',
    title: 'Before you head out to film',
    context: 'A small preparation list for an AI glasses shoot.',
    lines: [
      'Charge the glasses and phone',
      'Check permission to record at the location',
      'Bring ordinary glasses for comparison',
    ],
    options: [],
  },
  {
    id: 'opening-lines',
    format: 'writing',
    title: 'Which opening sounds more like you?',
    context: 'Choose a line, then see how the opening could continue.',
    lines: [
      '“I wore AI glasses for a day. The best feature wasn’t the camera.”',
      '“If my phone already does everything, why would I need AI glasses?”',
    ],
    options: [
      {
        label: 'Use the first',
        response:
          '“It was being able to capture a thought without stopping what I was doing. But that convenience comes with a few trade-offs. Here is what happened over one ordinary day.”',
      },
      {
        label: 'Use the second',
        response:
          '“I picked three tasks I actually do: recording an idea, finding my way and capturing a moment. For each one, I compared the glasses with the phone already in my pocket.”',
      },
    ],
  },
  {
    id: 'stage-review',
    format: 'recap',
    title: 'From an idea to a shoot-ready plan.',
    context:
      'A stage-review example: the topic, opening and shot list are ready. The filming time is the remaining decision.',
    options: [
      {
        label: 'Plan the shoot',
        response:
          'Next: choose the date, location and a realistic filming window. Keep a backup location in case of weather.',
      },
      {
        label: 'Refine the script',
        response:
          'Review the opening promise, remove unsupported claims and make sure each scene delivers one clear observation.',
      },
      {
        label: 'Set it aside',
        response:
          'This walkthrough is on hold. No reminder or calendar event was created.',
      },
    ],
  },
  {
    id: 'wait-for-quote',
    format: 'waiting',
    title: 'The draft can wait.',
    context:
      'In this example, you chose to wait for a quote before contacting the brand. There is nothing to send yet.',
    options: [
      {
        label: 'Review what’s missing',
        response:
          'Before continuing: confirm the budget, deliverables, usage rights, exclusivity and payment terms.',
      },
      {
        label: 'Continue preparing',
        response:
          'Prepare a reply with placeholders for the missing terms, then review it once the quote arrives. No email will be sent.',
      },
    ],
  },
];
