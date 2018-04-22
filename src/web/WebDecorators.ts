import 'reflect-metadata';

export const INCEPTUM_WEB_METADATA_KEY = 'inceptum-web';

export interface InceptumWebRouteMetadata {
  verb?: string,
  path: string,
  methodName: string,
}

export class InceptumWebMetadata {
  routes: InceptumWebRouteMetadata[] = [];
}

export function hasWebDecoratorMetadata(target: any): boolean {
  return Reflect.hasMetadata(INCEPTUM_WEB_METADATA_KEY, target);
}

export function getWebDecoratorMetadata(target: any): InceptumWebMetadata {
  return Reflect.getMetadata(INCEPTUM_WEB_METADATA_KEY, target);
}

function getOrCreateMetadata(target: any): InceptumWebMetadata {
  if (hasWebDecoratorMetadata(target)) {
    return getWebDecoratorMetadata(target);
  }
  const metadata = new InceptumWebMetadata();
  Reflect.defineMetadata(INCEPTUM_WEB_METADATA_KEY, metadata, target);
  return metadata;
}

export namespace WebDecorator {
  export function Get(path: string) {
    return Route('get', path);
  }

  export function Post(path: string) {
    return Route('post', path);
  }

  export function Put(path: string) {
    return Route('put', path);
  }

  export function Delete(path: string) {
    return Route('delete', path);
  }

  export function Route(verb: string, path: string) {
    return (target: any, key: string) => {
      // console.log('Called Autowire');
      const metadata = getOrCreateMetadata(target);
      metadata.routes.push({verb, path, methodName: key});
    };
  }
}
