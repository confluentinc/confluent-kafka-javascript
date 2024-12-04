"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleRegistry = void 0;
/**
 * RuleRegistry is used to register and fetch rule executors and actions.
 */
var RuleRegistry = /** @class */ (function () {
    function RuleRegistry() {
        this.ruleExecutors = new Map();
        this.ruleActions = new Map();
    }
    /**
     * registerExecutor is used to register a new rule executor.
     * @param ruleExecutor - the rule executor to register
     */
    RuleRegistry.prototype.registerExecutor = function (ruleExecutor) {
        this.ruleExecutors.set(ruleExecutor.type(), ruleExecutor);
    };
    /**
     * getExecutor fetches a rule executor by a given name.
     * @param name - the name of the rule executor to fetch
     */
    RuleRegistry.prototype.getExecutor = function (name) {
        return this.ruleExecutors.get(name);
    };
    /**
     * getExecutors fetches all rule executors
     */
    RuleRegistry.prototype.getExecutors = function () {
        return Array.from(this.ruleExecutors.values());
    };
    /**
     * registerAction is used to register a new rule action.
     * @param ruleAction - the rule action to register
     */
    RuleRegistry.prototype.registerAction = function (ruleAction) {
        this.ruleActions.set(ruleAction.type(), ruleAction);
    };
    /**
     * getAction fetches a rule action by a given name.
     * @param name - the name of the rule action to fetch
     */
    RuleRegistry.prototype.getAction = function (name) {
        return this.ruleActions.get(name);
    };
    /**
     * getActions fetches all rule actions
     */
    RuleRegistry.prototype.getActions = function () {
        return Array.from(this.ruleActions.values());
    };
    /**
     * clear clears all registered rules
     */
    RuleRegistry.prototype.clear = function () {
        this.ruleExecutors.clear();
        this.ruleActions.clear();
    };
    /**
     * getGlobalInstance fetches the global instance of the rule registry
     */
    RuleRegistry.getGlobalInstance = function () {
        return RuleRegistry.globalInstance;
    };
    /**
     * registerRuleExecutor is used to register a new rule executor globally.
     * @param ruleExecutor - the rule executor to register
     */
    RuleRegistry.registerRuleExecutor = function (ruleExecutor) {
        RuleRegistry.globalInstance.registerExecutor(ruleExecutor);
    };
    /**
     * registerRuleAction is used to register a new rule action globally.
     * @param ruleAction - the rule action to register
     */
    RuleRegistry.registerRuleAction = function (ruleAction) {
        RuleRegistry.globalInstance.registerAction(ruleAction);
    };
    RuleRegistry.globalInstance = new RuleRegistry();
    return RuleRegistry;
}());
exports.RuleRegistry = RuleRegistry;
