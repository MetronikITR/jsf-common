import { LayoutInfoInterface }          from '../../../register/interfaces';
import {
  JsfAbstractSpecialLayout,
  jsfAbstractSpecialLayoutJsfDefinitionLayoutItems,
  jsfAbstractSpecialLayoutJsfDefinitionSchemaProperties
}                                       from '../../../layout';
import { EditorInterfaceLayoutFactory } from '../../../editor/helpers/editor-factory/editor-interface-layout-factory';
import { JsfRegister }                  from '../../../register';

const layoutInfo: LayoutInfoInterface = {
  type             : 'paragraph',
  title            : 'Paragraph',
  category         : 'Text',
  icon             : 'layout-icons/paragraph.svg',
  defaultDefinition: {
    type : 'paragraph',
    title: 'Paragraph text'
  }
};

export class JsfLayoutParagraph extends JsfAbstractSpecialLayout<'paragraph'> {

  title: string;

  templateData?: {
    $eval: string,
    dependencies?: string[]
  };

  constructor(data: JsfLayoutParagraph) {
    super();
    Object.assign(this, data);
  }
}

export const layoutParagraphJsfDefinition = {
  schema: {
    type      : 'object',
    properties: {
      ...jsfAbstractSpecialLayoutJsfDefinitionSchemaProperties,

      title       : {
        type : 'string',
        title: 'Title'
      },
      templateData: {
        type      : 'object',
        title     : 'Template data',
        properties: {
          $eval       : {
            type   : 'string',
            title  : 'Eval',
            handler: {
              type   : 'common/code-editor',
              options: {
                language: 'javascript'
              }
            }
          },
          dependencies: {
            type : 'array',
            title: 'Dependencies',
            items: {
              type: 'string'
            }
          }
        }
      }
    }
  },
  layout: {
    type : 'div',
    items: [
      ...EditorInterfaceLayoutFactory.createPanelGroup([
        ...EditorInterfaceLayoutFactory.createPanel('Paragraph', [
          {
            type : 'div',
            items: [
              {
                key: 'title'
              },
              {
                type     : 'div',
                htmlClass: 'ml-2 mt-3',
                items    : [
                  {
                    type : 'heading',
                    title: 'Template data',
                    level: 5
                  },
                  {
                    key: 'templateData.$eval'
                  },
                  {
                    type : 'div',
                    items: [
                      {
                        type : 'heading',
                        title: 'Dependencies',
                        level: 6
                      },
                      {
                        type : 'array',
                        key  : 'templateData.dependencies',
                        items: [
                          {
                            type : 'expansion-panel-content',
                            items: [
                              {
                                type: 'hr'
                              },
                              {
                                type     : 'div',
                                htmlClass: 'd-flex justify-content-between',
                                items    : [
                                  {
                                    type: 'div'
                                  },
                                  {
                                    type       : 'button',
                                    icon       : 'delete',
                                    color      : 'accent',
                                    preferences: {
                                      variant: 'icon'
                                    },
                                    onClick    : [
                                      {
                                        arrayItemRemove: {
                                          path : 'templateData.dependencies',
                                          index: {
                                            $eval: 'return $getItemIndex(\'templateData.dependencies[]\')'
                                          }
                                        }
                                      }
                                    ]
                                  }
                                ]
                              },
                              {
                                key: 'templateData.dependencies[]'
                              }
                            ]
                          }
                        ]
                      },
                      {
                        type     : 'div',
                        visibleIf: {
                          $eval       : 'return !$val.templateData.dependencies.length',
                          dependencies: [
                            'templateData'
                          ]
                        },
                        items    : [
                          {
                            type     : 'span',
                            htmlClass: 'd-block py-4 text-center',
                            title    : 'No dependencies yet.'
                          }
                        ]
                      },
                      {
                        type           : 'row',
                        horizontalAlign: 'center',
                        htmlClass      : 'mt-2',
                        items          : [
                          {
                            type   : 'button',
                            title  : 'Add dependency',
                            onClick: {
                              arrayItemAdd: {
                                path: 'templateData.dependencies'
                              }
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]),

        ...jsfAbstractSpecialLayoutJsfDefinitionLayoutItems
      ])
    ]
  }
};

JsfRegister.layout('paragraph', layoutInfo, layoutParagraphJsfDefinition);

