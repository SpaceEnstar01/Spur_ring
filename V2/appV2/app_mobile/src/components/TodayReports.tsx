import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { todayDemo } from '../agent/todayDemo';
import {
  performanceReport as report,
  scriptReport,
} from '../agent/demoReports';

type Sections = string[][];
function Sections({ items }: { items: Sections }) {
  return (
    <>
      {items.map(([title, text]) => (
        <View key={title} style={s.section}>
          <Text style={s.sectionTitle}>{title}</Text>
          <Text selectable style={s.body}>
            {text}
          </Text>
        </View>
      ))}
    </>
  );
}
function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function PerformanceReport() {
  return (
    <View>
      <ImageBackground
        source={todayDemo.performance.thumbnail}
        style={s.hero}
        imageStyle={s.heroImage}
        accessibilityLabel="Paris travel report preview with illustrative 62 percent view lift"
      >
        <View style={s.heroShade}>
          <Text style={s.heroKicker}>PARIS STREET FOOD</Text>
          <Text style={s.heroNumber}>+62%</Text>
          <Text style={s.heroCaption}>Views vs. channel baseline</Text>
        </View>
      </ImageBackground>
      <Text style={s.scope}>{report.scope}</Text>
      <Heading>Executive summary</Heading>
      <Text selectable style={s.body}>
        {report.summary}
      </Text>
      <Heading>The performance report</Heading>
      {report.comparisons.map(metric => (
        <View key={metric.label} style={s.metric}>
          <Text style={s.sectionTitle}>{metric.label}</Text>
          <View style={s.values}>
            <View style={s.valueColumn}>
              <Text style={s.metricLabel}>Channel baseline</Text>
              <Text style={s.baselineValue}>{metric.baseline}</Text>
            </View>
            <View style={s.valueColumn}>
              <Text style={s.metricLabel}>This video</Text>
              <Text style={s.currentValue}>{metric.current}</Text>
            </View>
          </View>
          <Text style={s.lift}>{metric.change}</Text>
        </View>
      ))}
      <Heading>Relative performance at a glance</Heading>
      <Text style={s.scope}>
        Each baseline is indexed to 100. Bars compare relative lift, not
        absolute values across different metrics.
      </Text>
      {report.comparisons.map(metric => (
        <View key={metric.label} style={s.chartRow}>
          <Text style={s.chartTitle}>{metric.label}</Text>
          <View style={s.chartTrack}>
            <View style={[s.baselineBar, { width: `${(100 / 180) * 100}%` }]} />
            <Text style={s.chartNumber}>100</Text>
          </View>
          <View style={s.chartTrack}>
            <View
              style={[
                s.currentBar,
                { width: `${(metric.index / 180) * 100}%` },
              ]}
            />
            <Text style={s.chartNumber}>{metric.index}</Text>
          </View>
        </View>
      ))}
      <Text style={s.legend}>
        Gray: baseline · Blue: this video · Illustrative values
      </Text>
      <Heading>How to read these numbers</Heading>
      <Text selectable style={s.body}>
        {report.definitions}
      </Text>
      <Heading>What the results suggest</Heading>
      <Sections items={report.findings} />
      <Heading>What to borrow for your next film</Heading>
      <Sections items={report.lessons} />
      <Heading>A practical 5-minute shooting plan</Heading>
      <Sections items={report.shootPlan} />
      <Heading>Test the next episode</Heading>
      <Text selectable style={s.body}>
        {report.experiment}
      </Text>
      <Heading>Production checklist</Heading>
      {report.checklist.map((item, index) => (
        <View key={item} style={s.checkRow}>
          <Text style={s.checkNumber}>{index + 1}</Text>
          <Text selectable style={[s.body, s.flex]}>
            {item}
          </Text>
        </View>
      ))}
      <View style={s.takeaway}>
        <Text style={s.sectionTitle}>Your next move</Text>
        <Text selectable style={s.body}>
          Write one clear viewer question, plan three comparable experiences,
          and film enough evidence to deliver an honest verdict. Use the next
          upload to test the idea, rather than assuming the reference
          performance will repeat.
        </Text>
      </View>
    </View>
  );
}
export function ScriptReport() {
  const wordCount = scriptReport.scenes
    .map(scene => scene.narration)
    .join(' ')
    .split(/\s+/).length;
  return (
    <View>
      <ImageBackground
        source={todayDemo.script.thumbnail}
        style={s.hero}
        imageStyle={s.heroImage}
        accessibilityLabel="Santorini sunset creative reference"
      >
        <View style={s.heroShade}>
          <Text style={s.heroKicker}>CREATIVE REFERENCE</Text>
          <Text style={s.heroTitle}>Santorini Travel Guide 2024</Text>
          <Text style={s.heroCaption}>
            3.4M sample views · Travel / City Exploration
          </Text>
        </View>
      </ImageBackground>
      <Text style={s.scope}>{scriptReport.scope}</Text>
      <Heading>Creative brief</Heading>
      <Text selectable style={s.body}>
        {scriptReport.brief}
      </Text>
      <Heading>Research snapshot</Heading>
      <Text style={s.scope}>
        Constructed 10-video example set · Overlapping patterns
      </Text>
      {scriptReport.patterns.map(([title, count, description]) => (
        <View key={title} style={s.pattern}>
          <View style={s.patternHeader}>
            <Text style={[s.sectionTitle, s.flex]}>{title}</Text>
            <Text style={s.patternCount}>{count}</Text>
          </View>
          <Text selectable style={s.body}>
            {description}
          </Text>
        </View>
      ))}
      <Text selectable style={s.scope}>
        {scriptReport.method}
      </Text>
      <Heading>The reusable structure</Heading>
      <Sections items={scriptReport.breakdown} />
      <Heading>Three opening hooks to try</Heading>
      {scriptReport.hooks.map((hook, index) => (
        <View key={hook} style={s.quote}>
          <Text style={s.sceneLabel}>OPTION {index + 1}</Text>
          <Text selectable style={s.quoteText}>
            “{hook}”
          </Text>
        </View>
      ))}
      <Heading>Complete sample script</Heading>
      <Text style={s.scope}>
        {wordCount} spoken words · Approximately 5 minutes with a deliberate
        delivery and natural sound. Timing is an editing guide; rehearse and
        adjust.
      </Text>
      <Text style={s.scriptTitle}>Santorini Beyond the Postcard</Text>
      {scriptReport.scenes.map(scene => (
        <View key={scene.title} style={s.scene}>
          <Text style={s.sceneLabel}>{scene.time}</Text>
          <Text style={s.sectionTitle}>{scene.title}</Text>
          <Text style={s.visualLabel}>PICTURE & SOUND</Text>
          <Text selectable style={s.body}>
            {scene.visual}
          </Text>
          <View style={s.narration}>
            <Text style={s.visualLabel}>SPOKEN SCRIPT</Text>
            <Text selectable style={s.scriptBody}>
              {scene.narration}
            </Text>
          </View>
        </View>
      ))}
      <Heading>From script to finished video</Heading>
      <Sections items={scriptReport.production} />
      <View style={s.takeaway}>
        <Text style={s.sectionTitle}>Adapt it to your project</Text>
        <Text selectable style={s.body}>
          Keep the opening question, three experiences, personal trade-off, and
          useful verdict. Replace the destination and observations with your
          own. The action below opens this complete sample in a conversation
          draft so you can revise it before sending.
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    height: 210,
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  heroImage: { borderRadius: 20 },
  heroShade: {
    backgroundColor: '#12203570',
    borderRadius: 20,
    padding: 18,
    justifyContent: 'flex-end',
    height: '100%',
  },
  heroKicker: {
    color: '#FFFFFFDD',
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  heroNumber: {
    color: '#FFFFFF',
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: -2,
  },
  heroCaption: { color: '#FFFFFF', fontSize: 12, lineHeight: 19, marginTop: 6 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '700',
  },
  scope: { fontSize: 11, lineHeight: 18, color: '#8A94A4', marginBottom: 14 },
  heading: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '700',
    color: '#162139',
    marginTop: 26,
    marginBottom: 13,
  },
  body: { fontSize: 14, lineHeight: 24, color: '#657185' },
  section: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F5',
  },
  sectionTitle: {
    color: '#23304A',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 7,
  },
  metric: {
    backgroundColor: '#F4F7FD',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  values: { flexDirection: 'row', gap: 12, marginTop: 6 },
  valueColumn: { flex: 1 },
  metricLabel: { color: '#8591A3', fontSize: 10, marginBottom: 7 },
  baselineValue: { color: '#7E8BA0', fontSize: 22, fontWeight: '500' },
  currentValue: { color: '#1E4FAD', fontSize: 24, fontWeight: '700' },
  lift: { color: '#23966B', fontSize: 12, marginTop: 12, fontWeight: '600' },
  chartRow: { marginBottom: 17 },
  chartTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#536079',
    marginBottom: 8,
  },
  chartTrack: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  baselineBar: { height: 9, backgroundColor: '#CCD4E1', borderRadius: 4 },
  currentBar: { height: 9, backgroundColor: '#5587EA', borderRadius: 4 },
  chartNumber: { fontSize: 10, color: '#8691A5', marginLeft: 6 },
  legend: { color: '#929BAA', fontSize: 10, marginBottom: 10 },
  checkRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  checkNumber: {
    color: '#3478F6',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  flex: { flex: 1 },
  takeaway: {
    borderRadius: 18,
    backgroundColor: '#F2F6FD',
    padding: 17,
    marginVertical: 24,
  },
  pattern: {
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#FCF6F8',
    marginBottom: 10,
  },
  patternHeader: { flexDirection: 'row', gap: 8 },
  patternCount: { fontSize: 11, color: '#C34F78', fontWeight: '600' },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#E7B3C5',
    padding: 15,
    backgroundColor: '#FFF8FA',
    marginBottom: 12,
  },
  quoteText: { fontSize: 15, lineHeight: 25, color: '#67455A' },
  sceneLabel: {
    color: '#AA6681',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '600',
    marginBottom: 8,
  },
  scriptTitle: {
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '700',
    color: '#29334A',
    marginBottom: 12,
  },
  scene: {
    borderWidth: 1,
    borderColor: '#EBEDF3',
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
  },
  visualLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#939CAC',
    fontWeight: '600',
    marginBottom: 7,
    marginTop: 8,
  },
  narration: {
    borderTopWidth: 1,
    borderTopColor: '#ECEEF3',
    paddingTop: 8,
    marginTop: 13,
  },
  scriptBody: { fontSize: 15, lineHeight: 26, color: '#334056' },
});
