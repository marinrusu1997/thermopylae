<h1 align="center">@thermopylae/lib.async</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/lib.async/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Utilities for async operations.

## Install

```sh
npm install @thermopylae/lib.async
```

## Description
This package contains utilities for async operations.
More details can be found in API doc.

## Usage
Below is a use case example of how [LabeledConditionalVariableManager][label-conditional-variable-manager-link] can be used.
```typescript
import { 
    LabeledConditionalVariableManager, 
    LockedOperationType, 
    AwaiterRole 
} from '@thermopylae/lib.async';
import {
    AsyncFunction
} from '@thermopylae/core.declarations';

class Cache {
    // acts as Read-Write Lock, i.e. shared for Reads, exclusive for Writes
    private readonly conditionalVariable: LabeledConditionalVariableManager<string, string>;
    private readonly entries: Map<string, string>; // assuming they will expire somehow
    private readonly storageReader: AsyncFunction<string, string>;
    private readonly storageWriter: AsyncFunction<string, void>;

    public constructor(
        storageReader: AsyncFunction<string, string>,
        storageWriter: AsyncFunction<string, void>
    ) {
        this.conditionalVariable = new LabeledConditionalVariableManager();
        this.entries = new Map<string, string>();
        this.storageReader = storageReader;
        this.storageWriter = storageWriter;
    }
    
    public async get(key: string): string | undefined {
        // acquire read-write lock
        // in case it is acquired already by `set` operation, wait will throw
        const lock = await this.conditionalVariable.wait(key, LockedOperationType.READ);
        
        if (lock.role === AwaiterRole.CONSUMER) {
            // lock has been acquired already by someone who initiated `get` operation for this key
            // just return promise and wait untill PRODUCER will resolve/reject it
            return lock.promise;
        }
        
        let value = this.entries.get(key);
        if (value === undefined) {
            try {
                value = await this.storageReader(key);
                this.entries.set(key, value);
            } catch (e) {
                // we are the producer, so we need to notify ourself and other consumers about failure
                // also the lock needs to be released, so that `set` operation can acquire it
                this.conditionalVariable.notifyAll(key, e);
                return lock.promise;       
            }
        }

        // we are the producer, so we need to notify ourself and other consumers with value of the key
        // also the lock needs to be released, so that `set` operation can acquire it
        this.conditionalVariable.notifyAll(key, value);
        
        return lock.promise;
    }
    
    public async set(key: string, value: string): void {
        // acquire exclusive lock
        // in case it is acquired already by `set` or `get` cache operations, wait will throw
        await this.conditionalVariable.wait(key, LockedOperationType.WRITE);
        
        // there is no need to check for producer consumer roles, 
        // because WRITE lock is either acquired, or an error is thrown
        
        let err: Error | undefined = undefined;
        try {
            await this.storageWriter(key, value);
            this.entries.set(key, value);
        } catch (e) {
            err = e;
        }
        
        // release exclusive lock, so it can be used by either `set` or `get` cache operations
        this.conditionalVariable.notifyAll(key, err);
    }
}
```

[PromiseExecutor][promise-executor-link]
```typescript
import { PromiseExecutor } from '@thermopylae/lib.async';

function fetchUserDetails(accountId: string): Promise<object> {
    return fetch(`http://localhost:8080/user/${accountId}`);
}

// will process id's in batches of 2 elements, 
// i.e. will make up to 2 network calls simultaneusly 
let results = PromiseExecutor.run(
    fetchUserDetails,
    [1, 2, 3, 4, 5],
    2
);
console.log(results);

// will process all id's in parallel, 
// i.e. will make 5 network calls simultaneusly 
results = PromiseExecutor.run(
    fetchUserDetails,
    [1, 2, 3, 4, 5],
    PromiseExecutor.PARALLEL
);
console.log(results);

// will process id's in sequential order, 
// i.e. will 1 network call simultaneusly 
results = PromiseExecutor.run(
    fetchUserDetails,
    [1, 2, 3, 4, 5],
    PromiseExecutor.SEQUENTIAL
);
console.log(results);
```

## API Reference
API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:
```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/lib.async run doc
```

## Author
👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License
Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/lib.async/index.html
[label-conditional-variable-manager-link]: https://marinrusu1997.github.io/thermopylae/lib.async/classes/concurrency_labeled_conditional_variable_manager.labeledconditionalvariablemanager.html
[promise-executor-link]: https://marinrusu1997.github.io/thermopylae/lib.async/classes/concurrency_promise_executor.promiseexecutor.html
