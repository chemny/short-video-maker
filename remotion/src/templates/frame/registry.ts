import {Spec} from './kit';
export {checkSpan} from './kit';
import {BigFigure} from './components/BigFigure';
import {BigLine} from './components/BigLine';
import {BraceExpand} from './components/BraceExpand';
import {ConvergeMerge} from './components/ConvergeMerge';
import {Timeline} from './components/Timeline';

// The component library, keyed by claim type (references/component-library.md). The Director picks from `type`.
export const components: Spec<any>[] = [BigFigure, BigLine, Timeline, BraceExpand, ConvergeMerge];
export const byType = (type: string): Spec<any> | undefined => components.find((c) => c.type === type);
