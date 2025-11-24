import NumberComponent from "./Number";
import me from "math-expressions";
import { renameStateVariable } from "../utils/stateVariables";
import { textToAst } from "../utils/math";
import { textFromChildren } from "../utils/text";

export default class Integer extends NumberComponent {
    static componentType = "integer";
    static rendererType = "number";

    static returnChildGroups() {
        return [
            {
                group: "textLike",
                componentTypes: ["string", "text"],
            },
        ];
    }

    static createAttributesObject() {
        let attributes = super.createAttributesObject();
        attributes.representation = {
            createComponentOfType: "text",
            createStateVariable: "representation",
            defaultValue: "decimal",
            public: true,
            validValues: ["decimal", "binary", "hexadecimal"],
        };
        return attributes;
    }

    static returnStateVariableDefinitions() {
        let stateVariableDefinitions = super.returnStateVariableDefinitions();

        renameStateVariable({
            stateVariableDefinitions,
            oldName: "value",
            newName: "valuePreRound",
        });

        stateVariableDefinitions.valuePreRound = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "integer",
                addAttributeComponentsShadowingStateVariables: {
                    fixed: {
                        stateVariableToShadow: "fixed",
                    },
                },
            },
            hasEssential: true,
            defaultValue: NaN,
            returnDependencies: () => ({
                textLikeChildren: {
                    dependencyType: "child",
                    childGroups: ["textLike"],
                    variableNames: ["text"],
                },
                representation: {
                    dependencyType: "stateVariable",
                    variableName: "representation",
                },
            }),
            definition: function ({ dependencyValues }) {
                if (dependencyValues.textLikeChildren.length === 0) {
                    return {
                        useEssentialOrDefaultValue: {
                            valuePreRound: true,
                        },
                    };
                }

                let text = textFromChildren(dependencyValues.textLikeChildren);

                let base = 10;
                if (dependencyValues.representation === "binary") {
                    base = 2;
                } else if (dependencyValues.representation === "hexadecimal") {
                    base = 16;
                }

                let value = parseInt(text, base);

                return { setValue: { valuePreRound: value } };
            },
            inverseDefinition: function ({
                desiredStateVariableValues,
                dependencyValues,
            }) {
                let desiredValue = desiredStateVariableValues.valuePreRound;

                let base = 10;
                if (dependencyValues.representation === "binary") {
                    base = 2;
                } else if (dependencyValues.representation === "hexadecimal") {
                    base = 16;
                }

                let newText = desiredValue.toString(base);

                if (dependencyValues.textLikeChildren.length === 1) {
                    return {
                        success: true,
                        instructions: [
                            {
                                setDependency: "textLikeChildren",
                                desiredValue: newText,
                                childIndex: 0,
                                variableIndex: 0,
                            },
                        ],
                    };
                } else if (dependencyValues.textLikeChildren.length === 0) {
                    return {
                        success: true,
                        instructions: [
                            {
                                setEssentialValue: "valuePreRound",
                                value: desiredValue,
                            },
                        ],
                    };
                } else {
                    // TODO: how to handle multiple children?
                    // For now, we don't handle this case.
                    return { success: false };
                }
            },
        };

        // Still specify the value of an integer with the essential variable value
        // Needed so that can creating an integer component from serialized state as:
        // {componentType: "integer", state: {value: 3}}

        stateVariableDefinitions.text = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "text",
            },
            forRenderer: true,
            returnDependencies: () => ({
                textLikeChildren: {
                    dependencyType: "child",
                    childGroups: ["textLike"],
                    variableNames: ["text"],
                },
            }),
            definition: function ({ dependencyValues }) {
                if (dependencyValues.textLikeChildren.length === 0) {
                    // If no children, we attempt to get the text from the value
                    // that was set essentially.
                    // We need to do this as the text variable of the superclass
                    // is based on value for display, which we don't have here.
                    // TODO: how to get the original representation?
                    // For now, we will use the decimal representation.
                    return {
                        useEssentialOrDefaultValue: {
                            text: true,
                        },
                    };
                }

                let text = textFromChildren(dependencyValues.textLikeChildren);
                return { setValue: { text } };
            },
            inverseDefinition: function ({
                desiredStateVariableValues,
                dependencyValues,
            }) {
                let desiredValue = desiredStateVariableValues.text;

                if (dependencyValues.textLikeChildren.length === 1) {
                    return {
                        success: true,
                        instructions: [
                            {
                                setDependency: "textLikeChildren",
                                desiredValue: desiredValue,
                                childIndex: 0,
                                variableIndex: 0,
                            },
                        ],
                    };
                } else if (dependencyValues.textLikeChildren.length === 0) {
                    return {
                        success: true,
                        instructions: [
                            {
                                setEssentialValue: "text",
                                value: desiredValue,
                            },
                        ],
                    };
                } else {
                    return { success: false };
                }
            },
        };

        stateVariableDefinitions.value = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "integer",
            },
            returnDependencies: () => ({
                valuePreRound: {
                    dependencyType: "stateVariable",
                    variableName: "valuePreRound",
                },
            }),
            set: function (value) {
                // this function is called when
                // - definition is overridden by a copy prop
                // - when processing new state variable values
                //   (which could be from outside sources)
                if (value === null) {
                    return NaN;
                }
                let number = Number(value);
                if (Number.isNaN(number)) {
                    try {
                        number = me
                            .fromAst(textToAst.convert(value))
                            .evaluate_to_constant();
                        if (number === null) {
                            number = NaN;
                        }
                    } catch (e) {
                        number = NaN;
                    }
                }
                return Math.round(number);
            },
            definition({ dependencyValues }) {
                return {
                    setValue: {
                        value: Math.round(dependencyValues.valuePreRound),
                    },
                };
            },
            inverseDefinition({ desiredStateVariableValues }) {
                let desiredValue = desiredStateVariableValues.value;
                if (desiredValue instanceof me.class) {
                    desiredValue = desiredValue.evaluate_to_constant();
                } else {
                    desiredValue = Number(desiredValue);
                }
                desiredValue = Math.round(desiredValue);

                return {
                    success: true,
                    instructions: [
                        {
                            setDependency: "valuePreRound",
                            desiredValue,
                        },
                    ],
                };
            },
        };

        stateVariableDefinitions.decimal = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "text",
            },
            returnDependencies: () => ({
                value: {
                    dependencyType: "stateVariable",
                    variableName: "value",
                },
            }),
            definition: function ({ dependencyValues }) {
                let decimal = dependencyValues.value;
                if (Number.isNaN(decimal)) {
                    return { setValue: { decimal: NaN } };
                }
                return { setValue: { decimal: decimal.toString(10) } };
            },
        };

        stateVariableDefinitions.binary = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "text",
            },
            returnDependencies: () => ({
                value: {
                    dependencyType: "stateVariable",
                    variableName: "value",
                },
            }),
            definition: function ({ dependencyValues }) {
                let binary = dependencyValues.value;
                if (Number.isNaN(binary)) {
                    return { setValue: { binary: NaN } };
                }
                return { setValue: { binary: binary.toString(2) } };
            },
        };

        stateVariableDefinitions.hexadecimal = {
            public: true,
            shadowingInstructions: {
                createComponentOfType: "text",
            },
            returnDependencies: () => ({
                value: {
                    dependencyType: "stateVariable",
                    variableName: "value",
                },
            }),
            definition: function ({ dependencyValues }) {
                let hexadecimal = dependencyValues.value;
                if (Number.isNaN(hexadecimal)) {
                    return { setValue: { hexadecimal: NaN } };
                }
                return { setValue: { hexadecimal: hexadecimal.toString(16) } };
            },
        };

        return stateVariableDefinitions;
    }
}