import { JsfAbstractItemsLayout }                      from '../../abstract/abstract-layout';
import { DefCategory, DefExtends, DefProp, DefLayout } from '../../../jsf-for-jsf/decorators';
import { JsfUnknownLayout }                            from '../../index';
import { DefLayoutInfo }                               from '../../../jsf-register-decorators';

@DefLayoutInfo({
  type: 'div',
  title: 'Div',
  icon: 'layout-icons/div.svg',
  items: {
    enabled: true
  }
})
@DefLayout({
  type: 'div',
  items: [
    {
      type: 'row',
      items: [
        {
          type: 'col',
          xs: 6,
          items: [
            {
              type: 'heading',
              level: 5,
              title: 'Vertical Scroll'
            },
            {
              key: 'scroll.vertical',
              preferences: {
                variant: 'slider'
              },
              htmlClass: 'h5'
            }
          ]
        },
        {
          type: 'col',
          xs: 6,
          items: [
            {
              type: 'heading',
              level: 5,
              title: 'Horizontal Scroll'
            },
            {
              key: 'scroll.horizontal',
              preferences: {
                variant: 'slider'
              },
              htmlClass: 'h5'
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      level: 5,
      title: 'Custom code - on scroll stop',
      htmlClass: 'mt-3'
    },
    {
      key: 'scroll.onScrollStop.$eval'
    }
  ]
})
@DefExtends('JsfAbstractItemsLayout')
@DefCategory('Layout')
export class JsfLayoutDiv extends JsfAbstractItemsLayout<'div'> {
  @DefProp('JsfUnknownLayout[]')
  items: JsfUnknownLayout[];

  @DefProp({
    type: 'object',
    properties: {
      vertical: {
        type: 'boolean'
      },
      horizontal: {
        type: 'boolean'
      },
      onScrollStop: {
        type: 'object',
        properties: {
          $eval: {
            type: 'string',
            title: 'Eval',
            handler: {
              type: 'common/code-editor',
              options: {
                language: 'javascript'
              }
            }
          }
        }
      }
    }
  })
  scroll?: {
    vertical?: boolean;
    horizontal?: boolean;

    onScrollStop?: {
      $eval: string
    }
  };

  constructor(data: JsfLayoutDiv) {
    super();
    Object.assign(this, data);
  }
}
