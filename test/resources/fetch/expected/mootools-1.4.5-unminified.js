(function(){

this.MooTools = {
	version: '1.4.5',
	build: 'ab8ea8824dc3b24b6666867a2c4ed58ebb762cf0'
};

// Function overloading

var Function = this.Function;

var enumerables = true;
for (var i in {toString: 1}) enumerables = null;
if (enumerables) enumerables = ['hasOwnProperty', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'constructor'];

})();
