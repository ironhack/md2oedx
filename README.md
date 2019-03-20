md2oedx
=======

Translates markdown files and a structure json file into an importable Open Edx course

<!-- toc -->
## Usage
`md2oedx ./source/path ./destination/path`

The source path should contain the markdown files and the json file with the course structure. Defaults to current directory.

The output will be written to the destination path. Defaults to current directory.

## JSON File Structure

Here is a sample json file that describes a course:
```
{
  "course": {
    "name": "Course Title",
    "number": "CT",
    "chapter": [{
        "name": "Module 1",
        "sequential": [{
            "name": "Submodule 1",
            "vertical": [{
                "name": "Lesson 1",
                "html": [{
                    "file": "markdown1"
                  }
                ]
              },
              {
                "name": "Lesson 2",
                "html": [{
                  "file": "markdown2"
                }]
              }
            ]
          },
          {
            "name": "Submodule 2",
            "vertical": []
          }
        ]
      },
      {
        "name": "Module 2",
        "sequential": []
      }
    ]
  }
}
```
