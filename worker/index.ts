interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnvironment {
  ASSETS: AssetBinding;
}

const worker = {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    return environment.ASSETS.fetch(request);
  },
};

export default worker;
