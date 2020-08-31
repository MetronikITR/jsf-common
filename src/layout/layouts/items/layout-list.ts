import { LayoutInfoInterface }          from '../../../register/interfaces';
import {
  JsfAbstractItemsLayout,
  jsfAbstractItemsLayoutJsfDefinitionLayoutItems,
  jsfAbstractItemsLayoutJsfDefinitionSchemaProperties,
  JsfLayoutListItem
}                                       from '../../../layout';
import { EditorInterfaceLayoutFactory } from '../../../editor/helpers/editor-factory/editor-interface-layout-factory';
import { JsfRegister }                  from '../../../register';

const layoutInfo: LayoutInfoInterface = {
  type : 'list',
  title: 'List',
  icon : 'layout-icons/list.svg',
  items: {
    enabled: true,
    fixed  : ['list-item']
  }
};

export class JsfLayoutList extends JsfAbstractItemsLayout<'list'> {

  items: JsfLayoutListItem[];

  preferences?: JsfLayoutListPreferences;

  constructor(data: JsfLayoutList) {
    super();
    Object.assign(this, data);
  }
}

export interface JsfLayoutListPreferences {
  /**
   * List type, ordered or unordered.
   * Default is 'unordered'.
   */
  type: 'ordered' | 'unordered';
}

export const layoutListJsfDefinition = {
  schema: {
    type      : 'object',
    properties: {
      ...jsfAbstractItemsLayoutJsfDefinitionSchemaProperties,

    }
  },
  layout: {
    type : 'div',
    items: [
      ...EditorInterfaceLayoutFactory.createPanelGroup([

        ...jsfAbstractItemsLayoutJsfDefinitionLayoutItems,
      ]),
    ]
  }
};

JsfRegister.layout('list', layoutInfo, layoutListJsfDefinition);
