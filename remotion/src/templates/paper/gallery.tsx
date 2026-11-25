import React from 'react';
import {Composition, registerRoot, useCurrentFrame} from 'remotion';
import {PaperFrame} from './PaperFilm';
import {Shot, paperRecipes} from './recipes';

// Studio gallery: `npm run gallery` in remotion/. One 9 s composition per recipe, with sample content from unrelated
// topics and synthetic cue times so the motion can be reviewed. Sample data only; real jobs supply Director-compiled cues.
const art = (kind: string) => ({art: kind});
const samples: Record<string, {caption: string; shot: Omit<Shot, 'id' | 'start' | 'end'>}> = {
  'paper-statement': {caption: '利率下调先影响月供', shot: {recipe: 'paper-statement', kicker: '财经观察', image: art('house'), imageAt: 0.2, lines: [{text: '这轮降息，', at: 0.8}, {text: '最先改变的是月供', at: 1.8, accent: true}], notes: [{text: '利率下调的效果，会先出现在每月还款上，而不是房价。', at: 3.2}]}},
  'paper-stat': {caption: '新车销量里，电动车占了一半多', shot: {recipe: 'paper-stat', kicker: '数据观察', title: '电动车渗透率', label: '2026 年上半年 · 示例数据', value: '58', unit: '%', at: 0.8, trend: [22, 31, 38, 46, 58], trendAt: 2.2, context: '新车销量中纯电与插混合计占比', contextAt: 3.6, points: [{text: '连续五个季度上升', at: 4.2}, {text: '增速快于去年同期', at: 5.2}, {text: '三四线城市提升最明显', at: 6.2}]}},
  'paper-list': {caption: '先从睡前刷手机说起', shot: {recipe: 'paper-list', kicker: '健康科普', title: '睡不好的三个原因', rows: [{image: art('moon'), title: '睡前刷手机', sub: '蓝光推迟入睡时间', at: 1}, {image: art('device'), title: '作息不固定', sub: '生物钟被反复打乱', at: 3}, {image: art('cup'), title: '下午喝咖啡', sub: '咖啡因代谢需要很久', at: 5}]}},
  'paper-compare': {caption: '没有标准答案', shot: {recipe: 'paper-compare', kicker: '生活选择', title: '租房还是买房', sides: [{label: '租房', image: art('city'), at: 1, points: [{text: '门槛低', at: 1.6}, {text: '搬家灵活', at: 2.2}, {text: '没有资产增值', at: 2.8}]}, {label: '买房', image: art('house'), at: 3.6, points: [{text: '首付压力大', at: 4.2}, {text: '长期固定居住', at: 4.8}, {text: '房价有波动风险', at: 5.4}]}], connector: {text: '或', at: 3.4}, verdict: {text: '取决于你要在一座城市待多久', at: 6.4}}},
  'paper-timeline': {caption: '6月起开始抽查', shot: {recipe: 'paper-timeline', kicker: '政策解读', title: '新规落地三步', steps: [{when: '1月1日', what: '新规正式生效', image: art('document'), at: 1, whatAt: 1.4}, {when: '3月底', what: '企业完成自查', image: art('people'), at: 3, whatAt: 3.4}, {when: '6月起', what: '开始抽查并公布结果', image: art('chart'), at: 5, whatAt: 5.4}]}},
  'paper-points': {caption: '两点和隐私有关', shot: {recipe: 'paper-points', kicker: '用户控制', title: '两点说明', groups: [{head: '自愿选择', headAt: 1, numAt: 0.4, image: art('shield'), lines: [{text: '默认关闭', at: 1.6}, {text: '随时可以取消', at: 2.4}]}, {head: '数据去向', headAt: 4, numAt: 3.6, image: art('server'), lines: [{text: '仅用于本次回答', at: 4.6}, {text: '不会用于训练', at: 5.4}]}]}},
  'paper-flow': {caption: '骑手取餐后送到门口', shot: {recipe: 'paper-flow', kicker: '原理解释', title: '一单外卖怎么送到', nodes: [{image: art('people'), label: '你下单', sub: '选餐并付款', at: 1}, {image: art('document'), label: '平台派单', sub: '匹配最近的骑手', at: 3}, {image: art('pin'), label: '骑手配送', sub: '取餐后送到门口', at: 5}]}},
  'paper-quote': {caption: '要看谁先把资源准备好', shot: {recipe: 'paper-quote', kicker: '人物观点', quote: '真正的竞争，是看谁能把资源提前准备好', quoteAt: 0.6, who: '某行业分析师', source: '示例引语 · 来源标注位', whoAt: 3, image: art('people')}},
  'paper-media': {caption: '机房里一排排机柜', shot: {recipe: 'paper-media', kicker: '现场', title: '算力基础设施', image: art('server'), imageAt: 0.4, label: '官方图片', labelAt: 1.2, source: '来源：示例', points: [{text: '机柜与线缆密集排布', at: 3}, {text: '电力与散热是关键', at: 4.2}]}},
  'paper-split': {caption: '芯片是这一切的底层', shot: {recipe: 'paper-split', kicker: '科技解释', title: '模型为什么吃算力', image: art('layers'), imageAt: 0.4, lines: [{head: '参数越多', text: '每次计算量越大', at: 1.6}, {head: '训练要反复', text: '数据要读很多遍', at: 3.2}, {head: '服务要实时', text: '上线后仍要持续算', at: 4.8}]}},
};

const Sample = ({id}: {id: string}) => {
  const f = useCurrentFrame(), {caption, shot} = samples[id], Painter = paperRecipes[shot.recipe];
  return <PaperFrame channel="频道名" progress="示例" caption={caption}><Painter f={f} shot={{...shot, id, start: 0, end: 9} as Shot}/></PaperFrame>;
};
const Root = () => <>{Object.keys(samples).map((id) => <Composition key={id} id={id} component={() => <Sample id={id}/>} width={1080} height={1920} fps={30} durationInFrames={270}/>)}</>;
registerRoot(Root);
