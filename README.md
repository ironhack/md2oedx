md2oedx
=======

Translates markdown files and a structure json file into an importable Open Edx course

## Install
`npm install -g md2oedx`

## Usage

```
md2oedx ./source/path ./destination/path
```

The source path should contain a plain structure of markdown files and a json file named **index.json** with the course structure. Defaults to current directory.

or specifying your own json file:
```
md2oedx ./source/path/foo.json ./destination/path
```

or specifying a yaml file:
```
md2oedx ./source/path/index.yaml ./destination/path
```

The output will be written to the destination path. Defaults to current directory.

## JSON File Structure

Here is a sample json file that describes a course:
```json
{
  "course": {
    "name": "Course Title",
    "number": "CT",
    "chapter": [
      {
        "name": "Unit 1",
        "sequential": [
          {
            "name": "Weekday",
            "vertical": [
              {
                "name": "Lesson 1",
                "component": [{
                    "type": "html",
                    "file": "markdowns/lesson1.md"
                }]
              },
              {
                "name": "Lesson 2",
                "component": [{
                    "type": "html",
                    "file": "markdowns/lesson2.md"
                }]
              }
            ]
          },
          {
            "name": "Weekend",
            "vertical": [{
                "name": "Homework",
                "component": [{
                    "type": "deliverable",
                    "display_name": "Homework",
                    "deliverable_identifier": "assign1",
                    "deliverable_description": "Your first homework is to do 100 pushups.",
                    "deliverable_duedate": "2030-10-28"
                }]
            }]
          }
        ]
      },
      {
        "name": "Unit 2",
        "sequential": []
      }
    ]
  }
}
```
