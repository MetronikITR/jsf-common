import { evalProperty, evalPropertyWithDependencies, evalPropertyWithDependenciesAndLayoutDependencies } from './schema/eval';
import { dynamicSwitchableProperty }                                                                     from './schema/dynamic-switchable-property';
import { editorPropName }                                                                                from './editor-interface-utils';

export abstract class EditorInterfaceSchemaFactory {

  /**
   * Eval property generators.
   */
  static createEvalProperty                                      = evalProperty;
  static createEvalPropertyWithDependencies                      = evalPropertyWithDependencies;
  static createEvalPropertyWithDependenciesAndLayoutDependencies = evalPropertyWithDependenciesAndLayoutDependencies;

  /**
   * Dynamic prop generators.
   */
  static createDynamicSwitchableProperty = dynamicSwitchableProperty;

  /**
   * Compound generators.
   */
  static createJsfValueOptionsProperty = (basePath: string, propName: string, propType: 'dynamic' | 'any') => {
    return EditorInterfaceSchemaFactory.createDynamicSwitchableProperty(basePath, propName, [
      {
        typeKey: 'key',
        typeName: 'Key',
        propDefinition: {
          type: 'string'
        }
      },
      {
        typeKey: 'const',
        typeName: 'Constant',
        propDefinition: propType === 'any'
          ? {
            type: 'object',
            properties: {},
            handler: {
              type: 'any'
            }
          }
          : {
            type: '@@PROP_TYPE'
          }
      },
      {
        typeKey: 'eval',
        typeName: 'Eval',
        propDefinition: {
          type: 'object',
          properties: {
            ... EditorInterfaceSchemaFactory.createEvalProperty()
          }
        }
      },
      {
        typeKey: 'paste',
        typeName: 'Paste',
        propDefinition: {
          type: 'string'
        }
      }
    ]);
  };

  static createOnClickProperty = (basePath: string, propName: string) => {
    const propFullPath = `${ basePath ? basePath + '.' : ''}${ propName }`;
    const editorPropFullPath = `${ basePath ? basePath + '.' : ''}${ propName }[].${ editorPropName(propName) }`;

    return {
      [propName]: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            // Type switcher
            [editorPropName(propName)]: {
              type: 'string',
              required: true,
              default: '$eval',
              handler: {
                type: 'common/dropdown',
                values: [
                  { label: 'Run eval', value: '$eval' },
                  { label: 'Abort', value: 'abort' },
                  { label: 'Emit event', value: 'emit' },
                  { label: 'Set value', value: 'setValue' },
                  { label: 'Patch value', value: 'patchValue' },
                  { label: 'Validate', value: 'validate' },
                  { label: 'Submit', value: 'submit' },
                  { label: 'Add item to array', value: 'arrayItemAdd' },
                  { label: 'Remove item from array', value: 'arrayItemRemove' },
                  { label: 'Navigate to', value: 'navigateTo' },
                  { label: 'DFF action', value: 'dff' },
                  { label: 'Show dialog', value: 'showDialog' },
                  { label: 'Hide dialog', value: 'hideDialog' },
                  { label: 'Open form dialog', value: 'openFormDialog' },
                  { label: 'Close form dialog', value: 'closeFormDialog' },
                  { label: 'Show loading indicator', value: 'showLoadingIndicator' },
                  { label: 'Hide loading indicator', value: 'hideLoadingIndicator' },
                  { label: 'Stepper next', value: 'stepperNext' },
                  { label: 'Stepper previous', value: 'stepperPrevious' },
                  { label: 'Clipboard', value: 'clipboard' },
                  { label: 'Show notification', value: 'showNotification' },
                  { label: 'Run service action', value: 'runServiceAction' },
                ]
              }
            },

            // Condition (always available)
            condition: {
              type: 'object',
              properties: {
                ... EditorInterfaceSchemaFactory.createEvalProperty(),
              }
            },

            // Abort
            abort: {
              type: 'object',
              enabledIf: {
                $eval: `return $getPropValue('${ editorPropFullPath }') === 'abort'`,
                dependencies: [editorPropFullPath]
              },
              properties: {
                ... EditorInterfaceSchemaFactory.createEvalProperty()
              }
            },

            // Eval
            ... {
              $eval: {
                ... EditorInterfaceSchemaFactory.createEvalProperty().$eval,
                enabledIf: {
                  $eval: `return $getPropValue('${ editorPropFullPath }') === '$eval'`,
                  dependencies: [editorPropFullPath]
                },
              }
            },

            // Emit
            emit: {
              type: 'object',
              enabledIf: {
                $eval: `return $getPropValue('${ editorPropFullPath }') === 'emit'`,
                dependencies: [editorPropFullPath]
              },
              properties: {
                onLinked: {
                  type: 'boolean',
                  title: 'Run this action on linked form'
                },
                event: {
                  type: 'string',
                },
                ... EditorInterfaceSchemaFactory.createJsfValueOptionsProperty(`${ propFullPath }[].emit`, 'value', 'any')
              }
            },
          }
        }
      }
    }
  }
}
