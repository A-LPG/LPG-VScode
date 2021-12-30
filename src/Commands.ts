'use strict';

export namespace Constant{
    export  const  LPG_GENERATION = "lpg.generation.setting";
}
/**
 * Commonly used commands
 */
export namespace Commands {
    /**
     * Open Browser
     */
    export const OPEN_BROWSER = 'vscode.open';

    /**
    * Open LPG log files side by side
    */
    export const OPEN_LOGS = 'lpg.open.logs';

    
    /**
    * Open Java Language Server Log file
    */
     export const OPEN_SERVER_LOG = 'lpg.open.serverLog';

     /**
     * Open Java client Log file
     */
     export const OPEN_CLIENT_LOG = 'lpg.open.clientLog';

     export const LPG_MAKE_NON_EMPTY = 'lpg.MakeNonEmpty';


     export const LPG_MAKE_EMPTY = 'lpg.makeEmpty';
     export const LPG_MAKE_LEFT_RECURSIVE = 'lpg.MakeLeftRecursive';

     export const LPG_MAKE_INLINE_NONT_TERMINAL = 'lpg.inlineNonTerminal';


     export const LPG_CALL_GRAPH = 'lpg.call-graph';

     export const LPG_RRD_SINGLE_RULE = 'lpg.rrd.singleRule';

     
     export const LPG_RRD_ALL_RULE = 'lpg.rrd.allRules'

     export const LPG_FIRST_SET_SINGLE_RULE = 'lpg.firset.singleRule';

     
     export const LPG_FIRST_SET_ALL_RULE = 'lpg.firset.allRules'

     export const LPG_FOLLOW_SET_SINGLE_RULE = 'lpg.fowllow.singleRule';

     
     export const LPG_FOLLOW_SET_ALL_RULE = 'lpg.fowllow.allRules'
}