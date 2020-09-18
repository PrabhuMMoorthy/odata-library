"use strict";

const assert = require("assert");
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const _ = require("lodash");

const defaultType = {
  format: (x) => `'${x}'`,
  formatBody: (x) => x,
};

describe("RequestDefinition", function () {
  var entitySet;
  var request;
  let Filter;
  let Sorter;

  beforeEach(function () {
    Filter = sinon.stub();
    Sorter = sinon.stub();
    Filter.prototype.toURIComponent = sinon.stub();
    Sorter.prototype.toURIComponent = sinon.stub();
    let Request = proxyquire("../../../lib/engine/RequestDefinition", {
      "./entitySet/Filter": Filter,
      "./entitySet/Sorter": Sorter,
    });
    entitySet = {
      agent: {
        logger: {
          warn: sinon.stub(),
        },
      },
      count: sinon.stub(),
      createNavigationProperty: () => {},
      entityTypeModel: {
        key: [
          {
            name: "KEY1",
            type: defaultType,
          },
          {
            name: "KEY2",
            type: defaultType,
          },
        ],
        navigationProperties: [],
      },
      executeGet: sinon.stub(),
      getListResourcePath: () => "path",
      getSingleResourcePath: () => "path",
      urlQuery: (x) => x,
    };
    request = new Request(entitySet, {});
  });

  describe(".count()", function () {
    it("calls entity set count", function () {
      request.count();
      assert.ok(entitySet.count.calledWith(request));
    });
  });

  describe(".get()", function () {
    it("accepts call with no argument", function () {
      request.get();
      assert.ok(entitySet.executeGet.called);
    });
    it("accepts 1 numeric argument (top)", function () {
      sinon.stub(request, "top");
      let num = 9;
      request.get(num);
      assert.ok(request.top.calledWith(num));
    });
    it("accepts 1 object argument (key)", function () {
      sinon.stub(request, "key");
      let key = {};
      request.get(key);
      assert.ok(request.key.calledWith(key));
    });
    it("throws error for invalid arguments", function () {
      assert.throws(() => request.get("blah"));
      assert.throws(() => request.get({}, "blah"));
      assert.throws(() => request.get(1, "blah"));
    });
  });

  describe(".key()", function () {
    it("Raises error for invalid key", function () {
      assert.throws(() => {
        request.key(null);
      }, /not plain object/);
      assert.throws(() => {
        request.key(10);
      }, /not plain object/);
      assert.throws(() => {
        request.key([]);
      }, /not plain object/);
    });
    it("Set valid key to parameters", function () {
      request.key({
        KEY1: "VALUE1",
        KEY2: "VALUE2",
        KEY3: "VALUE3",
      });
      assert.deepEqual(request._keyValue, {
        KEY1: "VALUE1",
        KEY2: "VALUE2",
      });
    });
    it("Raises error for missing value in key", function () {
      assert.throws(() => {
        request.key({
          KEY2: "VALUE2",
          KEY3: "VALUE3",
        });
      });
    });
  });

  describe(".parameter()", function () {
    it("Raises error for invalid resource type", function () {
      assert.throws(() => {
        request.parameter("name", "value");
      }, /doesn't support parameters/);
    });
  });

  describe(".parameters()", function () {
    it("adds all parameters", function () {
      sinon.stub(request, "parameter");
      request.parameters({
        name1: "value1",
        name2: "value2",
      });

      assert.ok(request.parameter.calledWith("name1", "value1"));
      assert.ok(request.parameter.calledWith("name2", "value2"));
    });
  });

  describe(".registerAssociations()", function () {
    it("creates association properties", function () {
      entitySet.entityTypeModel.navigationProperties = [
        {
          name: "navProp1",
        },
      ];
      request.registerAssociations();
      assert.ok(_.has(request, "navProp1"));
      assert.ok(_.has(request, "navigationProperties.navProp1"));
    });
    it("logs shorcut collisions", function () {
      entitySet.entityTypeModel.navigationProperties = [
        {
          name: "_resource",
        },
      ];
      request.registerAssociations();
      assert.ok(_.has(request, "navigationProperties._resource"));
      assert.ok(entitySet.agent.logger.warn.called);
    });
  });

  describe(".select()", function () {
    it("throws error for missing arguments", function () {
      assert.throws(() => request.select());
    });
  });

  describe(".filter()", function () {
    it("adds encoded filter", function () {
      sinon.stub(request, "setQueryParameter");
      Filter.prototype.toURIComponent.returns("FILTER_ENCODED");
      request.filter("FILTER_DEFINITION");
      assert.ok(Filter.calledWith("FILTER_DEFINITION"));
      assert.deepEqual(request.setQueryParameter.getCall(0).args, [
        "$filter",
        "FILTER_ENCODED",
      ]);
    });
  });

  describe(".orderby()", function () {
    it("adds encoded sort", function () {
      sinon.stub(request, "setQueryParameter");
      Sorter.prototype.toURIComponent.returns("ORDERBY_CLAUSE");
      request.orderby("SORT_DEFINITION1", "SORT_DEFINITION2");
      assert.ok(
        Sorter.calledWith(entitySet.entityTypeModel, [
          "SORT_DEFINITION1",
          "SORT_DEFINITION2",
        ])
      );
      assert.deepEqual(request.setQueryParameter.getCall(0).args, [
        "$orderby",
        "ORDERBY_CLAUSE",
      ]);
    });
  });

  describe(".expand()", function () {
    it("throws error for missing arguments", function () {
      assert.throws(() => request.expand());
    });
  });

  describe(".calculatePath()", function () {
    it("stream path", function () {
      request._resource.entityTypeModel.hasStream = true;
      request.calculatePath();
      assert.strictEqual(request._path, "/path/$value");
    });
    it("list path", function () {
      sinon.stub(request, "_isList").get(function () {
        return true;
      });
      sinon.stub(request._resource, "urlQuery").returns("QUERY");
      request.calculatePath();
      assert.strictEqual(request._path, "/path?QUERY");
    });
    it("entity path", function () {
      sinon.stub(request, "_isList").get(function () {
        return false;
      });
      sinon.stub(request._resource, "urlQuery").returns("QUERY");
      request.calculatePath();
      assert.strictEqual(request._path, "/path?QUERY");
    });
  });
});