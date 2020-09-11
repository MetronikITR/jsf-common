import { JsfAbstractBuilder }                                 from './abstract/abstract-builder';
import { JsfPage }                                            from '../jsf-page';
import { JsfBuilder }                                         from './jsf-builder';
import { JsfTranslatableMessage, JsfTranslationServer }       from '../translations';
import { JsfComponentBuilder }                                from './jsf-component-builder';
import { interval, Observable, Subject, timer, Subscription } from 'rxjs';
import { JsfDefinition }                                      from '../jsf-definition';
import { debounce, finalize, takeUntil, throttleTime }        from 'rxjs/operators';

/**
 * Global counter so each page can have uniq ID.
 */
let jsfPageId = 0;

export interface JsfPageBuilderOptionsInterface {
  jsfDefinitionProvider?: (key: string) => Observable<JsfDefinition>
  dataSourceProvider?: (req: DataSourceProviderRequestInterface) => Observable<DataSourceProviderResponseInterface>;
  dataSourceConfig?: any;
}

export interface DataSourceReqFunArg {
  filters?: any[],
  groupKey?: string,
  payload?: {
    /**
     * Extra key, could be used for PUT req.
     * */
    key?: any;

    /**
     * Extra data, could be used for POST req.
     */
    data?: any;
  }
}

export interface DataSourceProviderRequestInterface {
  /**
   * Uniq identification of data source. For example: db1://cars/bmw/parts
   * Name can be anything since it is on the implementor side to support data source types.
   */
  dataSource: string;

  /**
   * If set data source provider will be able to diferente between same data sources.
   * This is helpful for example if same data source is used more than once but each instance has different
   * filter set.
   */
  groupKey?: string;

  /**
   * Filters for given data source. Filters are gathered in array, it's implementors job to merge them.
   */
  filters?: any[];

  payload?: {
    /**
     * Extra key, could be used for PUT req.
     * */
    key?: any;

    /**
     * Extra data, could be used for POST req.
     */
    data?: any;
  };
}

export interface DataSourceProviderResponseInterface {
  /**
   * Check @DataSourceRequestInterface.dataSourceKey
   */
  dataSource: string;

  /**
   * Check @DataSourceRequestInterface.groupKey
   */
  groupKey?: string;

  /**
   * Check @DataSourceRequestInterface.filter
   */
  filters?: any[];

  /**
   * Response from data source provider.
   */
  value: any;
}

export class JsfPageBuilder extends JsfAbstractBuilder {

  protected onDestroy: Subject<void>                      = new Subject<void>();
  protected requestProcessDirtyDataSources: Subject<void> = new Subject<void>();

  pageDefinition: JsfPage;

  /**
   * All currently active component builder instances. Components can be registered and de-registered at any time.
   * Key in object represents component path, matching handler path in JSF.
   */
  components: { [componentPath: string]: JsfComponentBuilder } = {};

  dataSourcesInfo: {
    [dataSource: string]:
      {
        dirty: boolean;
        interval?: Subscription;
        components: {
          [componentPath: string]: {
            refreshInterval?: number;
            subscribed?: boolean;
            filters?: {
              groupKey?: string;
              path: string;
              hash: string;
              value: any;
            }[]
          }
        }
      }
  } = {};

  readonly jsfDefinitionProvider?: (key: string) => Observable<JsfDefinition>;
  readonly dataSourceProvider?: (req: DataSourceProviderRequestInterface) => Observable<DataSourceProviderResponseInterface>;
  readonly dataSourceConfig?: { [key: string]: { title: string } };

  private _id = jsfPageId++;
  get id(): number {
    return this._id;
  }

  dataSourceRequests: { dataSource: string, groupKey?: string }[] = [];

  /**
   * Main component of page. Same as root prop has empty string path, root component also has empty string as base.
   */
  get rootComponent(): JsfComponentBuilder {
    return this.components[''];
  }

  set rootComponent(x: JsfComponentBuilder) {
    this.components[''] = x;
  }

  get allComponentsReady() {
    for (const componentKey of Object.keys(this.components)) {
      if (!this.components[componentKey] || (!this.components[componentKey].jsfBuilder)) {
        return false;
      }
    }
    return true;
  }

  constructor(
    pageDefinition: JsfPage,
    options: JsfPageBuilderOptionsInterface = {}
  ) {
    super();
    this.pageDefinition        = pageDefinition;
    this.jsfDefinitionProvider = options.jsfDefinitionProvider;
    this.dataSourceProvider    = options.dataSourceProvider;
    this.dataSourceConfig      = options.dataSourceConfig;

    if (!this.pageDefinition.component) {
      throw new Error('Missing JSF Component in JSF page definition.');
    }
    this.rootComponent = new JsfComponentBuilder({
      jsfParentComponentBuilder: undefined,
      jsfComponentDefinition   : this.pageDefinition.component,
      jsfPageBuilder           : this,
      componentName            : ''
    });

    this.requestProcessDirtyDataSources
      .pipe(
        takeUntil(this.onDestroy),
        throttleTime(250, undefined, { leading: true, trailing: true })
      )
      .subscribe(() => this.processDirtyDataSources());
  }

  ////////////////////////////////////////////////////////////////////////////////////////////
  /// Helper functions
  ////////////////////////////////////////////////////////////////////////////////////////////

  requestJsfDefinition(key: string) {
    if (!this.jsfDefinitionProvider) {
      throw new Error('[JSF-PAGE] No jsfDefinitionProvider set.');
    }
    return this.jsfDefinitionProvider(key);
  }

  destroy() {
    this.onDestroy.next();
  }

  ////////////////////////////////////////////////////////////////////////////////////////////
  /// Component management
  ////////////////////////////////////////////////////////////////////////////////////////////

  registerRootComponent(jsfBuilder: JsfBuilder) {
    this.rootComponent.init(jsfBuilder, { noRegister: true });
    this._registerComponent('');
  }

  registerComponent(jsfComponentBuilder: JsfComponentBuilder) {
    this.components[jsfComponentBuilder.path] = jsfComponentBuilder;
    this._registerComponent(jsfComponentBuilder.path);
  }

  private _registerComponent(path: string) {
    this.registerComponentDataSourceFilter(path);
    this.registerComponentDataSourceSubscription(path);

    this.requestProcessDirtyDataSources.next();
  }

  deRegisterComponent(path: string) {
    // TODO
    // if (this.dataSourcesInfo[dataSourceKey].interval) {
    //   this.dataSourcesInfo[dataSourceKey].interval.unsubscribe();
    // }
    delete this.components[path];
  }

  debug() {
    return {
      components     : Object.keys(this.components)
        .map(x => this.components[x])
        .map(x => ({ path: x.path, hasJsfBuilder: !!x.jsfBuilder })),
      dataSourcesInfo: this.dataSourcesInfo
    };
  }

  private sendEventToComponents(eventKey: string, eventData: any, componentPaths: string[] = Object.keys(this.components)) {
    for (const componentPath of componentPaths) {
      if (!this.components[componentPath].jsfBuilder) {
        throw new Error(`[JSF-PAGE] Component <${ componentPath }> does not have builder yet.`);
      }
      this.components[componentPath].jsfBuilder.onExternalEvent(eventKey, eventData);
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////
  /// Data source capabilities
  ////////////////////////////////////////////////////////////////////////////////////////////

  private initDataSourcesInfoChunk(dataSource: string, componentPath: string) {
    this.dataSourcesInfo[dataSource]                                   = this.dataSourcesInfo[dataSource] || {
      components: {},
      dirty     : true
    };
    this.dataSourcesInfo[dataSource].components[componentPath]         = this.dataSourcesInfo[dataSource].components[componentPath]
      || {};
    this.dataSourcesInfo[dataSource].components[componentPath].filters = this.dataSourcesInfo[dataSource].components[componentPath].filters
      || [];
  }

  registerComponentDataSourceFilter(componentPath: string) {
    const jb = this.components[componentPath].jsfBuilder;
    if (!jb) {
      throw new Error(`[JSF-PAGE] Component's filters <${ componentPath }> can not be initialized since builder is not ready yet.`);
    }
    for (const filter of this.components[componentPath].jsfComponentDefinition.dataSourcesFilters || []) {
      this.initDataSourcesInfoChunk(filter.dataSource, componentPath);
      const { value, hash }                         = jb.getProp(filter.filterPath).getValueWithHash();
      this.dataSourcesInfo[filter.dataSource].dirty = true;
      this.dataSourcesInfo[filter.dataSource].components[componentPath].filters.push({
        value, hash, path: filter.filterPath
      });
      jb.getProp(filter.filterPath)
        .valueChange
        .pipe(takeUntil(this.onDestroy), debounce(() => timer(100)))
        .subscribe((x) => {
          this.onFilterChange(filter.dataSource, componentPath, filter.filterPath);
        });
    }
  }

  onFilterChange(dataSource: string, componentPath: string, filterPath: string) {
    const jb              = this.components[componentPath].jsfBuilder;
    const { value, hash } = jb.getProp(filterPath).getValueWithHash();
    const filterState     = this.dataSourcesInfo[dataSource].components[componentPath].filters.find(x => x.path === filterPath);
    if (filterState.hash === hash) {
      return;
    }
    filterState.hash  = hash;
    filterState.value = value;

    this.dataSourcesInfo[dataSource].dirty = true;

    this.processDirtyDataSources();
  }

  registerComponentDataSourceSubscription(componentPath: string) {
    const jb = this.components[componentPath].jsfBuilder;
    if (!jb) {
      throw new Error(`[JSF-PAGE] Component's filters <${ componentPath }> can not be initialized since builder is not ready yet.`);
    }
    for (const dataSource of this.components[componentPath].jsfComponentDefinition.dataSources || []) {
      this.initDataSourcesInfoChunk(dataSource.key, componentPath);
      this.dataSourcesInfo[dataSource.key].components[componentPath].refreshInterval = dataSource.refreshInterval;
      this.dataSourcesInfo[dataSource.key].components[componentPath].subscribed      = true;
      this.dataSourcesInfo[dataSource.key].dirty                                     = true;
      this.repairDataSourceInterval(dataSource.key);
    }
  }

  /**
   * Check for refresh interval flags
   * @param dataSourceKey
   */
  repairDataSourceInterval(dataSourceKey: string) {
    const refreshInterval = Object
      .keys(this.dataSourcesInfo[dataSourceKey].components)
      .reduce(
        (a, c) => {
          const nri = this.dataSourcesInfo[dataSourceKey].components[c].refreshInterval;
          return nri > 0 && (a === undefined || a > nri)
                 ? nri
                 : a;
        },
        undefined as number
      );

    if (this.dataSourcesInfo[dataSourceKey].interval) {
      this.dataSourcesInfo[dataSourceKey].interval.unsubscribe();
    }
    if (refreshInterval > 0) {
      this.dataSourcesInfo[dataSourceKey].interval = interval(refreshInterval)
        .pipe(
          takeUntil(this.onDestroy),
          finalize(() => this.dataSourcesInfo[dataSourceKey].interval.unsubscribe())
        )
        .subscribe(() => {
          this.processDataSource(dataSourceKey);
        });
    }
  }

  processDataSource(dataSourceKey: string) {
    if (!this.dataSourcesInfo[dataSourceKey]) {
      return;
    }
    if (this.dataSourceRequests.find(x => x.dataSource === dataSourceKey && !x.groupKey)) {
      return;
    }
    this.dataSourcesInfo[dataSourceKey].dirty = true;
    this.processDirtyDataSources();
  }

  forceProcessDataSource(dataSourceKey: string) {
    if (!this.dataSourcesInfo[dataSourceKey]) {
      return;
    }
    this.dataSourcesInfo[dataSourceKey].dirty = true;
    return this.processDirtyDataSources();
  }

  processDirtyDataSourcesIfNoActiveRequests() {
    if (this.dataSourceRequests.length) {
      return;
    }
    this.processDirtyDataSources();
  }

  processDataSources() {
    for (const dataSourceKey of Object.keys(this.dataSourcesInfo)) {
      if (!this.dataSourceRequests.find(x => x.dataSource === dataSourceKey && !x.groupKey)) {
        this.dataSourcesInfo[dataSourceKey].dirty = true;
      }
    }
    return this.processDirtyDataSources();
  }

  forceProcessDataSources() {
    for (const dataSourceKey of Object.keys(this.dataSourcesInfo)) {
      this.dataSourcesInfo[dataSourceKey].dirty = true;
    }
    return this.processDirtyDataSources();
  }

  processDirtyDataSources() {
    for (const dataSourceKey of Object.keys(this.dataSourcesInfo)) {
      const dataSource = this.dataSourcesInfo[dataSourceKey];
      if (!dataSource.dirty) {
        continue;
      }
      let filters      = [];
      const components = [];
      for (const componentKey of Object.keys(dataSource.components)) {
        const component = dataSource.components[componentKey];
        if (component.filters) {
          filters = filters.concat(component.filters);
        }
        if (component.subscribed) {
          components.push(componentKey);
        }
      }

      if (components.length) {
        dataSource.dirty = false;
        this.makeDataSourceRequest(dataSourceKey, {
          filters
        });
      }
    }
  }

  makeDataSourceInsertRequest(dataSourceKey: string, data: DataSourceReqFunArg = {}) {
    return this.makeDataSourceRequest(dataSourceKey + '#insert', data);
  }

  makeDataSourceUpdateRequest(dataSourceKey: string, data: DataSourceReqFunArg = {}) {
    return this.makeDataSourceRequest(dataSourceKey + '#update', data);
  }

  makeDataSourceRemoveRequest(dataSourceKey: string, data: DataSourceReqFunArg = {}) {
    return this.makeDataSourceRequest(dataSourceKey + '#remove', data);
  }

  makeDataSourceGetRequest(dataSourceKey: string, data: DataSourceReqFunArg = {}) {
    return this.makeDataSourceRequest(dataSourceKey + '#get', data);
  }

  private makeDataSourceRequest(dataSourceKey: string, data: DataSourceReqFunArg = {}) {
    if (!this.dataSourceProvider) {
      throw new Error('[JSF-PAGE] Missing data source provider.');
    }
    const request$ = this.dataSourceProvider({
      groupKey  : data.groupKey,
      dataSource: dataSourceKey,
      filters   : data.filters,
      payload   : data.payload
    });
    const reqKey = { dataSource: dataSourceKey, groupKey: data.groupKey };
    if (request$) {
      this.registerDataSourceRequest(reqKey);
      request$
        .pipe(
          takeUntil(this.onDestroy),
          finalize(() => {
              this.unregisterDataSourceRequest(reqKey);
              this.processDirtyDataSourcesIfNoActiveRequests();
            }
          )
        )
        .subscribe(x => {
          this.onDataSourcesRequestResponse(dataSourceKey, x);
        }, error => {
          this.onDataSourcesRequestFail(dataSourceKey, error);
        });
    } else {
      console.log(`[JSF-PAGE] No data source returned for ${ dataSourceKey }`);
    }
  }

  onDataSourcesRequestFail(dataSourceKey: string, error: any) {
    console.error(`[JSF-PAGE] No data source returned for ${ dataSourceKey }`);
    this.rootComponent.jsfBuilder.onError(error);
  }

  onDataSourcesRequestResponse(dataSourceKey: string, x: DataSourceProviderResponseInterface) {
    console.log('[JSF-DASH] onDataSourcesRequestResponse', x);

    const dataSource = this.dataSourcesInfo[dataSourceKey];
    for (const componentKey of Object.keys(dataSource.components)) {
      const component = dataSource.components[componentKey];
      if (!component.subscribed) {
        continue;
      }

      const componentBuilder = this.components[componentKey];
      if (!componentBuilder.jsfBuilder) { // component was register after req, that is ok it will make separate req
        continue;
      }
      componentBuilder.jsfBuilder.onExternalEvent(dataSourceKey, { ...x });
    }
  }

  private registerDataSourceRequest(reqKey: { dataSource: string, groupKey?: string }) {
    this.dataSourceRequests.push(reqKey);
    this.sendEventToComponents(
      'jsf-page://activeRequests/status-change',
      { activeRequestsCount: this.dataSourceRequests.length }
    );
  }

  /**
   * Req object reference must be same as called in registerDataSourceRequest.
   */
  private unregisterDataSourceRequest(reqKey: { dataSource: string, groupKey?: string }) {
    const index = this.dataSourceRequests.indexOf(reqKey);
    if (index !== -1) {
      this.dataSourceRequests.splice(index, 1);
    }
    this.sendEventToComponents(
      'jsf-page://activeRequests/status-change',
      { activeRequestsCount: this.dataSourceRequests.length }
    );
  }

  ////////////////////////////////////////////////////////////////////////////////////////////
  /// Nothing special mapping to the root component JSF builder
  ////////////////////////////////////////////////////////////////////////////////////////////

  validate(): Promise<boolean> {
    return this.rootComponent.jsfBuilder.validate();
  }

  getJsonValue(opt?: { virtual?: boolean, skipGetter?: boolean }): any {
    return this.rootComponent && this.rootComponent.jsfBuilder ? this.rootComponent.jsfBuilder.getJsonValue(opt) : null;
  }

  getValue(opt?: { virtual?: boolean, skipGetter?: boolean }): any {
    return this.rootComponent && this.rootComponent.jsfBuilder ? this.rootComponent.jsfBuilder.getValue(opt) : null;
  }

  lock(lockKey?: Symbol): Symbol {
    return this.rootComponent.jsfBuilder.lock(lockKey);
  }

  isDiff(lockKey: Symbol): boolean {
    return this.rootComponent.jsfBuilder.isDiff(lockKey);
  }

  getDiff(lockKey: Symbol): any {
    return this.rootComponent.jsfBuilder.getDiff(lockKey);
  }

  getDiffKeys(lockKey: Symbol): string[] {
    return this.rootComponent.jsfBuilder.getDiffKeys(lockKey);
  }

  getJsonDiff(lockKey: Symbol): any {
    return this.rootComponent.jsfBuilder.getJsonDiff(lockKey);
  }

  async getPropTranslatableStrings(): Promise<JsfTranslatableMessage[]> {
    return this.rootComponent.jsfBuilder.getPropTranslatableStrings();
  }

  getStaticTranslatableStrings(): JsfTranslatableMessage[] {
    return this.rootComponent.jsfBuilder.getStaticTranslatableStrings();
  }

  get translationServer(): JsfTranslationServer {
    return this.rootComponent.jsfBuilder.translationServer;
  }
}
